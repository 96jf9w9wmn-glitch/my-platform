// Генераторы аналогов ОГЭ по АНГЛИЙСКОМУ ЯЗЫКУ (раздел «Грамматика и лексика», №20–34).
// Эталон типажей — открытый банк (РешуОГЭ/sdamgia), разобранный в fipi_bank_eng/tasks.json
// (инструменты: parse_docx.py, inventory.py, coverage.py). Тексты у нас СВОИ, оригинальные —
// не скопированные из банка; из ФИПИ берём только СТРУКТУРУ типажей (какие КЭС бывают в номере)
// и формулировку инструкции. Правильный ответ вычисляется ДЕТЕРМИНИРОВАННОЙ морфологической
// функцией из базового слова (как в математике ответ считается кодом), а не вписан «на глаз».
//
// Форма объекта задачи (совместима со схемой банка `tasks` и с TaskGenPreview/TaskCard):
//   { condition_text, answer, generated:true, number }
// condition_text рендерится как HTML (renderTaskMath экранирует и переносит \n→<br>), поэтому
// текст — обычный, без разметки; пропуск = подчёркивания + «(WORD)», как в реальном ОГЭ.

const pick = (a) => a[Math.floor(Math.random() * a.length)]
const VOWELS = "aeiou"
const isVowel = (c) => VOWELS.includes(c)

// ── Морфологический движок ───────────────────────────────────────────────────
// Все таблицы закрыты и проверяемы; функции покрывают только те слова, что мы используем
// в авторских текстах (каждый ответ дополнительно сверяется движком — см. selfCheck ниже).

const IRREGULAR_VERBS = {
  be: { past: "was", pastPl: "were", pp: "been", ing: "being" },
  become: { past: "became", pp: "become" }, begin: { past: "began", pp: "begun" },
  break: { past: "broke", pp: "broken" }, bring: { past: "brought", pp: "brought" },
  build: { past: "built", pp: "built" }, buy: { past: "bought", pp: "bought" },
  catch: { past: "caught", pp: "caught" }, choose: { past: "chose", pp: "chosen" },
  come: { past: "came", pp: "come" }, cost: { past: "cost", pp: "cost" },
  cut: { past: "cut", pp: "cut" }, do: { past: "did", pp: "done" },
  draw: { past: "drew", pp: "drawn" }, drink: { past: "drank", pp: "drunk" },
  drive: { past: "drove", pp: "driven" }, eat: { past: "ate", pp: "eaten" },
  fall: { past: "fell", pp: "fallen" }, feel: { past: "felt", pp: "felt" },
  find: { past: "found", pp: "found" }, fly: { past: "flew", pp: "flown" },
  forget: { past: "forgot", pp: "forgotten" }, get: { past: "got", pp: "got" },
  give: { past: "gave", pp: "given" }, go: { past: "went", pp: "gone" },
  grow: { past: "grew", pp: "grown" }, have: { past: "had", pp: "had" },
  hear: { past: "heard", pp: "heard" }, hold: { past: "held", pp: "held" },
  keep: { past: "kept", pp: "kept" }, know: { past: "knew", pp: "known" },
  lead: { past: "led", pp: "led" }, leave: { past: "left", pp: "left" },
  lend: { past: "lent", pp: "lent" }, lose: { past: "lost", pp: "lost" },
  make: { past: "made", pp: "made" }, meet: { past: "met", pp: "met" },
  pay: { past: "paid", pp: "paid" }, put: { past: "put", pp: "put" },
  read: { past: "read", pp: "read" }, ride: { past: "rode", pp: "ridden" },
  ring: { past: "rang", pp: "rung" }, rise: { past: "rose", pp: "risen" },
  run: { past: "ran", pp: "run" }, say: { past: "said", pp: "said" },
  see: { past: "saw", pp: "seen" }, sell: { past: "sold", pp: "sold" },
  send: { past: "sent", pp: "sent" }, set: { past: "set", pp: "set" },
  shine: { past: "shone", pp: "shone" }, show: { past: "showed", pp: "shown" },
  sing: { past: "sang", pp: "sung" }, sit: { past: "sat", pp: "sat" },
  sleep: { past: "slept", pp: "slept" }, speak: { past: "spoke", pp: "spoken" },
  spend: { past: "spent", pp: "spent" }, stand: { past: "stood", pp: "stood" },
  steal: { past: "stole", pp: "stolen" }, swim: { past: "swam", pp: "swum" },
  take: { past: "took", pp: "taken" }, teach: { past: "taught", pp: "taught" },
  tell: { past: "told", pp: "told" }, think: { past: "thought", pp: "thought" },
  throw: { past: "threw", pp: "thrown" }, understand: { past: "understood", pp: "understood" },
  wake: { past: "woke", pp: "woken" }, wear: { past: "wore", pp: "worn" },
  win: { past: "won", pp: "won" }, write: { past: "wrote", pp: "written" },
}

// число гласных групп ≈ число слогов (грубо, но достаточно для наших слов)
const vowelGroups = (v) => (v.match(/[aeiou]+/g) || []).length
// удвоение конечной согласной: односложное CVC (stop→stopped) и британское одиночное -l
// после одиночной гласной (travel→travelled). Двусложные без ударного конца НЕ удваивают
// (cover→covered, open→opened) — отсекаем по числу слогов.
const doublesFinal = (v) => {
  const n = v.length
  if (n < 2) return false
  const last = v[n - 1], prev = v[n - 2], before = n >= 3 ? v[n - 3] : ""
  if (last === "l" && isVowel(prev) && !isVowel(before)) return true // travel/cancel→…lled (BrE), но cool→cooled
  if ("wxy".includes(last)) return false                            // fix→fixing, play→played, snow→snowed
  if (vowelGroups(v) === 1 && !isVowel(last) && isVowel(prev) && (before === "" || !isVowel(before)))
    return true                                                     // stop→stopped, chat→chatting, run→running
  return false
}

const addEd = (v) => {
  if (v.endsWith("e")) return v + "d"                                // like→liked
  if (/[^aeiou]y$/.test(v)) return v.slice(0, -1) + "ied"            // study→studied
  if (doublesFinal(v)) return v + v[v.length - 1] + "ed"             // stop→stopped, travel→travelled
  return v + "ed"
}
const addS = (v) => {                                               // 3-е лицо ед.ч. / present simple
  if (/(s|ss|sh|ch|x|z|o)$/.test(v)) return v + "es"                 // goes, watches, misses
  if (/[^aeiou]y$/.test(v)) return v.slice(0, -1) + "ies"            // studies
  return v + "s"
}
const addIng = (v) => {
  if (IRREGULAR_VERBS[v]?.ing) return IRREGULAR_VERBS[v].ing
  if (v.endsWith("ie")) return v.slice(0, -2) + "ying"               // lie→lying
  if (v.endsWith("e") && v !== "be") return v.slice(0, -1) + "ing"   // make→making
  if (doublesFinal(v)) return v + v[v.length - 1] + "ing"            // run→running, travel→travelling
  return v + "ing"
}

// verb(base, form):
//   'base' | 's' (3sg) | 'ing' | 'past' | 'pastPl' (was→were) | 'pp'
//   'perf' (Present Perfect: have+pp) | 'perf3' (has+pp)
//   'negpast' (did not+base) | 'negpres' (do not+base) | 'negpres3' (does not+base)
// Форма ответа — как в ОГЭ: отрицания пишутся полностью («did not like»; сокращённый
// «didn’t like» тоже засчитывается на экзамене, но канон в банке — полная форма).
function verb(base, form) {
  const b = base.toLowerCase()
  const ir = IRREGULAR_VERBS[b]
  const pp = () => (ir ? ir.pp : addEd(b))
  if (form === "base") return b
  if (form === "s") return addS(b)
  if (form === "ing") return addIng(b)
  if (form === "past") return ir ? ir.past : addEd(b)
  if (form === "pastPl") return ir ? (ir.pastPl || ir.past) : addEd(b)
  if (form === "pp") return pp()
  if (form === "perf") return "have " + pp()
  if (form === "perf3") return "has " + pp()
  if (form === "negperf") return "have not " + pp()
  if (form === "negperf3") return "has not " + pp()
  if (form === "negpast") return "did not " + b
  if (form === "negpres") return "do not " + b
  if (form === "negpres3") return "does not " + b
  if (form === "will") return "will " + b                    // Future Simple
  if (form === "would") return "would " + b                  // косвенная речь: will→would
  if (form === "pastperf") return "had " + pp()              // Past Perfect
  if (form === "negpastperf") return "had not " + pp()
  if (form === "passWas") return "was " + pp()               // пассив прош., ед.ч.
  if (form === "passWere") return "were " + pp()             // пассив прош., мн.ч.
  if (form === "passIs") return "is " + pp()                 // пассив наст., ед.ч.
  if (form === "passAre") return "are " + pp()               // пассив наст., мн.ч.
  if (form === "negwould") return "would not " + b           // 2nd conditional / согл. времён, отриц.
  // Continuous — вспомогательный по подлежащему выбирается автором (форма фиксирована в spec)
  if (form === "contAm") return "am " + addIng(b)
  if (form === "contIs") return "is " + addIng(b)
  if (form === "contAre") return "are " + addIng(b)
  if (form === "contWas") return "was " + addIng(b)
  if (form === "contWere") return "were " + addIng(b)
  // «to be» в настоящем (b === "be")
  if (form === "am") return "am"
  if (form === "is") return "is"
  if (form === "are") return "are"
  throw new Error("verb: неизвестная форма " + form)
}

// модальные (то, что реально встречается в эталоне; расширяется по мере номеров)
const MODALS = { couldNeg: "could not", could: "could", would: "would", should: "should", mustNeg: "must not", canNeg: "cannot" }
const modal = (arg) => {
  if (!MODALS[arg]) throw new Error("modal: нет " + arg)
  return MODALS[arg]
}

const IRREGULAR_PLURALS = {
  child: "children", man: "men", woman: "women", person: "people", tooth: "teeth",
  foot: "feet", goose: "geese", mouse: "mice", ox: "oxen", louse: "lice",
  leaf: "leaves", knife: "knives", wife: "wives", life: "lives", wolf: "wolves",
  shelf: "shelves", half: "halves", loaf: "loaves", thief: "thieves", calf: "calves",
  policeman: "policemen", gentleman: "gentlemen", postman: "postmen", fireman: "firemen",
  sportsman: "sportsmen", businessman: "businessmen", fisherman: "fishermen",
  sheep: "sheep", deer: "deer", fish: "fish", series: "series", species: "species",
  potato: "potatoes", tomato: "tomatoes", hero: "heroes", echo: "echoes",
  photo: "photos", piano: "pianos", kilo: "kilos", zoo: "zoos", radio: "radios",
  datum: "data", medium: "media", cactus: "cacti", crisis: "crises",
}
function plural(base) {
  const b = base.toLowerCase()
  if (IRREGULAR_PLURALS[b]) return IRREGULAR_PLURALS[b]
  if (/[^aeiou]y$/.test(b)) return b.slice(0, -1) + "ies"            // city→cities
  if (/(s|ss|sh|ch|x|z)$/.test(b)) return b + "es"                  // box→boxes, bus→buses
  return b + "s"
}

const IRREGULAR_COMP = {
  good: ["better", "best"], bad: ["worse", "worst"], far: ["further", "furthest"],
  little: ["less", "least"], many: ["more", "most"], much: ["more", "most"],
  old: ["older", "oldest"], // (elder/eldest — особый случай, не используем)
}
// односложные и двусложные на -y инфлектируются; остальные — more/most (их не задаём в пуле)
const degree = (base, sup) => {
  const b = base.toLowerCase()
  if (IRREGULAR_COMP[b]) return IRREGULAR_COMP[b][sup ? 1 : 0]
  const suf = sup ? "est" : "er"
  if (b.endsWith("e")) return b + suf.slice(sup ? 0 : 0, 0) + (sup ? "st" : "r") // nice→nicer/nicest
  if (/[^aeiou]y$/.test(b)) return b.slice(0, -1) + "i" + suf        // happy→happier/happiest
  // односложное CVC → удвоение (big→bigger, hot→hottest); двусложные (clever) не удваивают
  if (vowelGroups(b) === 1 && b.length >= 3 && !isVowel(b[b.length - 1]) && isVowel(b[b.length - 2])
    && !isVowel(b[b.length - 3]) && !"wxy".includes(b[b.length - 1])) return b + b[b.length - 1] + suf
  return b + suf
}
const comparative = (b) => degree(b, false)
const superlative = (b) => degree(b, true)

const PRONOUNS = {
  i: { obj: "me", det: "my", pos: "mine", refl: "myself" },
  you: { obj: "you", det: "your", pos: "yours", refl: "yourself" },
  he: { obj: "him", det: "his", pos: "his", refl: "himself" },
  she: { obj: "her", det: "her", pos: "hers", refl: "herself" },
  it: { obj: "it", det: "its", pos: "its", refl: "itself" },
  we: { obj: "us", det: "our", pos: "ours", refl: "ourselves" },
  they: { obj: "them", det: "their", pos: "theirs", refl: "themselves" },
}
function pronoun(base, form) {
  const p = PRONOUNS[base.toLowerCase()]
  if (!p) throw new Error("pronoun: нет " + base)
  if (form === "subj") return base.toLowerCase()
  if (!p[form]) throw new Error("pronoun: форма " + form)
  return p[form]
}

const ORDINALS = {
  one: "first", two: "second", three: "third", four: "fourth", five: "fifth",
  six: "sixth", seven: "seventh", eight: "eighth", nine: "ninth", ten: "tenth",
  eleven: "eleventh", twelve: "twelfth", thirteen: "thirteenth", fourteen: "fourteenth",
  fifteen: "fifteenth", sixteen: "sixteenth", seventeen: "seventeenth", eighteen: "eighteenth",
  nineteen: "nineteenth", twenty: "twentieth", thirty: "thirtieth", forty: "fortieth",
  fifty: "fiftieth", hundred: "hundredth", thousand: "thousandth",
}
const ordinal = (card) => {
  const c = card.toLowerCase()
  if (ORDINALS[c]) return ORDINALS[c]
  throw new Error("ordinal: нет " + card)
}

// компаративы наречий (5.2.26) — закрытый список используемых
const ADVERB_COMP = {
  fast: "faster", hard: "harder", high: "higher", late: "later", long: "longer",
  soon: "sooner", early: "earlier", well: "better", badly: "worse",
  carefully: "more carefully", quickly: "more quickly", slowly: "more slowly",
  loudly: "more loudly", often: "more often",
}
const adverbComp = (b) => {
  const k = b.toLowerCase()
  if (!ADVERB_COMP[k]) throw new Error("adverbComp: нет " + b)
  return ADVERB_COMP[k]
}

// единый движок для авторских элементов: transform(word, spec) → строка-ответ
function transform(word, spec) {
  const [kind, arg] = spec.split(":")
  switch (kind) {
    case "verb": return verb(word, arg)
    case "modal": return modal(arg)
    case "plural": return plural(word)
    case "comp": return comparative(word)
    case "sup": return superlative(word)
    case "pron": return pronoun(word, arg)
    case "ord": return ordinal(word)
    case "advcomp": return adverbComp(word)
    default: throw new Error("transform: неизвестный вид " + kind)
  }
}

// ── Рендер задания ───────────────────────────────────────────────────────────
const INSTRUCTION =
  "Прочитайте приведённый ниже текст. Преобразуйте слово, напечатанное заглавными буквами " +
  "в скобках так, чтобы оно грамматически соответствовало содержанию текста. Заполните пропуск полученным словом."

const GAP = "____________"
// item: { text, word, spec }. В text ровно один плейсхолдер «@» — туда встаёт пропуск «GAP(WORD)».
function build(number, item) {
  // движок — источник истины; item.answer допускается только как явный override для форм,
  // которые движок не строит (многосложные степени more/most), и помечается skipCheck.
  const answer = item.answer ?? transform(item.word, item.spec)
  const body = item.text.replace("@", `${GAP}(${item.word.toUpperCase()})`)
  return {
    number,
    condition_text: `${INSTRUCTION}\n\n${body}`,
    answer,
    generated: true,
  }
}

// делает генератор-функцию из пула авторских элементов (случайный выбор)
const fromPool = (number, pool) => () => build(number, pick(pool))

// ── №20 · Грамматика (первый пропуск связного текста) ────────────────────────
// Типажи по эталону (fipi_bank_eng, №20): 5.2.15 глаголы (действ. залог, личные формы),
// 5.2.21 мн.ч. существительных, 5.2.24 местоимения, 5.2.25 прилагательные (степени),
// 5.2.26 наречия (степени), 5.2.27 числительные (порядковые).

const P20_VERBS = [
  // Past Simple (правильные и неправильные)
  { text: "Last summer Tom and his cousin @ to Scotland to see the old castles.", word: "travel", spec: "verb:past" },
  { text: "When the storm began, we @ back to the house as fast as we could.", word: "run", spec: "verb:past" },
  { text: "Yesterday my sister @ a new umbrella because hers was broken.", word: "buy", spec: "verb:past" },
  { text: "It was already dark when the children finally @ home from the park.", word: "come", spec: "verb:past" },
  { text: "The train @ the station before we reached the platform.", word: "leave", spec: "verb:past" },
  { text: "Last winter it @ so heavily that the roads were closed for two days.", word: "snow", spec: "verb:past" },
  // «to be» в прошедшем: ед. was / мн. were (по подлежащему)
  { text: "The film was long, but the ending @ really exciting.", word: "be", spec: "verb:past" },
  { text: "There @ a lot of people at the concert last Saturday.", word: "be", spec: "verb:pastPl" },
  // отрицание в прошедшем: did not + инфинитив
  { text: "Kate @ the film because it was too sad for her.", word: "like", spec: "verb:negpast", note: "did not like" },
  { text: "We @ the last bus, so we had to walk home in the rain.", word: "catch", spec: "verb:negpast", note: "did not catch" },
  // Present Perfect: have/has + причастие
  { text: "\"I @ my keys somewhere in the house,\" said Ann, looking upset.", word: "lose", spec: "verb:perf", note: "have lost" },
  { text: "My brother @ every book in this series and loves them all.", word: "read", spec: "verb:perf3", note: "has read" },
  // отрицание в настоящем: do not / does not + инфинитив
  { text: "My little sister @ her homework alone; our mum always helps her.", word: "do", spec: "verb:negpres3", note: "does not do" },
  { text: "\"We @ any milk left,\" mum said, \"so please go to the shop.\"", word: "have", spec: "verb:negpres", note: "do not have" },
]
const P20_PLURAL = [
  { text: "Most @ in our town love the new skating rink near the river.", word: "child", spec: "plural" },
  { text: "The dentist told me that all my @ were perfectly healthy.", word: "tooth", spec: "plural" },
  { text: "Two @ at the bus stop were talking about the football match.", word: "woman", spec: "plural" },
  { text: "In autumn the @ in the park turn yellow and red.", word: "leaf", spec: "plural" },
  { text: "Farmers in this village keep @ and grow potatoes.", word: "sheep", spec: "plural" },
]
// №20-эталон 5.2.24: формы — объектная (her/them) и притяжательная-определитель (her/their/its).
const P20_PRON = [
  { text: "Kate opened her bag and gave me @ favourite pen to try.", word: "she", spec: "pron:det" },
  { text: "The boys were proud of @ new football uniform.", word: "they", spec: "pron:det" },
  { text: "\"Can you help @ with this exercise?\" Ben asked his friend.", word: "i", spec: "pron:obj" },
  { text: "The little cat washed @ face in the morning sun.", word: "it", spec: "pron:det" },
  { text: "Grandma baked some cookies and gave @ to the neighbours' children.", word: "they", spec: "pron:obj" },
  { text: "Tom saw Kate at the stop and waved to @ from the bus window.", word: "she", spec: "pron:obj" },
]
const P20_ADJ = [
  { text: "This book is much @ than the one I read last week.", word: "interesting", spec: "comp", skipCheck: true },
  { text: "Today the weather is @ than it was yesterday.", word: "warm", spec: "comp" },
  { text: "The blue whale is the @ animal that has ever lived.", word: "big", spec: "sup" },
  { text: "Anna is the @ person I know — she is always smiling.", word: "happy", spec: "sup" },
  { text: "My new phone is @ than my old one in every way.", word: "good", spec: "comp" },
]
const P20_ADV = [
  { text: "Tom trained every day, so now he runs @ than his brother.", word: "fast", spec: "advcomp" },
  { text: "After the lessons Kate could speak English @ than before.", word: "well", spec: "advcomp" },
  { text: "If you explain the rule @, the pupils will understand it.", word: "carefully", spec: "advcomp" },
]
const P20_NUM = [
  { text: "January is the @ month of the year.", word: "one", spec: "ord" },
  { text: "Our classroom is on the @ floor of the school.", word: "two", spec: "ord" },
  { text: "He was the @ runner to cross the finish line.", word: "five", spec: "ord" },
  { text: "She read the article for the @ time to understand it.", word: "three", spec: "ord" },
  { text: "December is the @ month of the year.", word: "twelve", spec: "ord" },
]

// «interesting» — многосложное прилагательное: степень строится через more/most, а не суффиксом.
// Наш degree() к таким не применяется, поэтому ответ задаём явной проверкой ниже (skipCheck).
P20_ADJ[0].answer = "more interesting"

// ── №21 · Грамматика ─────────────────────────────────────────────────────────
// Типажи по эталону (fipi_bank_eng, №21): 5.2.15 глаголы (много времён), 5.2.16 пассив,
// 5.2.18 модальные (could not), 5.2.14 косвенная речь (will→would), 5.2.7 условные (First
// Conditional, will+инф.), 5.2.8 I wish (past), 5.2.21 мн.ч., 5.2.24 местоимения (their/him),
// 5.2.25 степени прилаг., 5.2.27 порядковые.
const P21_VERBS = [
  { text: "When I was young, we @ in a small village near the sea.", word: "live", spec: "verb:past" },              // Past Simple
  { text: "The concert @ wonderful, and everyone clapped for a long time.", word: "be", spec: "verb:past" },         // was
  { text: "The streets @ empty because of the heavy rain that evening.", word: "be", spec: "verb:pastPl" },          // were
  { text: "\"I @ so glad to see you again!\" Mary shouted happily.", word: "be", spec: "verb:am" },                  // am
  { text: "Be quiet, please — the baby @ in the next room.", word: "sleep", spec: "verb:contIs" },                   // is sleeping
  { text: "Look! The children @ football in the garden right now.", word: "play", spec: "verb:contAre" },            // are playing
  { text: "At six o'clock yesterday I @ dinner with my family.", word: "have", spec: "verb:contWas" },               // was having
  { text: "While we @ TV, the lights suddenly went out.", word: "watch", spec: "verb:contWere" },                    // were watching
  { text: "Don't worry, I @ you as soon as the train arrives.", word: "call", spec: "verb:will" },                   // will call
  { text: "\"I @ this exercise already,\" said Tom, closing his book.", word: "finish", spec: "verb:perf" },         // have finished
  { text: "She is happy because she @ all her exams at last.", word: "pass", spec: "verb:perf3" },                   // has passed
  { text: "By the time we got to the cinema, the film @ twenty minutes earlier.", word: "start", spec: "verb:pastperf" }, // had started
  { text: "My dad usually @ home at about seven in the evening.", word: "get", spec: "verb:s" },                     // gets
  { text: "Sam @ the answer, so he just stayed silent.", word: "know", spec: "verb:negpast" },                       // did not know
]
const P21_PASSIVE = [
  { text: "The new bridge across the river @ last year.", word: "build", spec: "verb:passWas" },                     // was built
  { text: "These letters @ to the wrong address by mistake yesterday.", word: "send", spec: "verb:passWere" },       // were sent
  { text: "The hall @ with flowers and lights for the celebration.", word: "decorate", spec: "verb:passWas" },       // was decorated
  { text: "Several windows @ during the terrible storm last night.", word: "break", spec: "verb:passWere" },         // were broken
]
const P21_MODAL = [
  { text: "Although Tom tried very hard, he @ open the heavy old door.", word: "can", spec: "modal:couldNeg" },       // could not
  { text: "It was so foggy that the driver @ see the road ahead.", word: "can", spec: "modal:couldNeg" },
]
const P21_PLURAL = [
  { text: "The little boy has already lost two of his baby @.", word: "tooth", spec: "plural" },                     // teeth
  { text: "After the long hike her @ hurt so much that she sat down.", word: "foot", spec: "plural" },              // feet
  { text: "Three @ were waiting patiently outside the small shop.", word: "woman", spec: "plural" },                // women
]
const P21_PRON = [
  { text: "The pupils quickly raised @ hands to answer the question.", word: "they", spec: "pron:det" },            // their
  { text: "Peter was late again, so we started the game without @.", word: "he", spec: "pron:obj" },                // him
]
const P21_ADJ = [
  { text: "My little sister is three years @ than me.", word: "young", spec: "comp" },                              // younger
  { text: "This is the @ road to the village, so let's take it.", word: "safe", spec: "sup" },                      // safest
  { text: "The second task in the test was @ than the first one.", word: "difficult", spec: "comp", skipCheck: true }, // more difficult
  { text: "I feel much @ today than I did yesterday morning.", word: "good", spec: "comp" },                        // better
]
const P21_NUM = [
  { text: "For many people Monday is the @ day of the working week.", word: "one", spec: "ord" },                   // first
  { text: "Yuri Gagarin was the @ man to travel into space.", word: "one", spec: "ord" },                           // first
]
const P21_COND = [
  { text: "If you hurry up now, you @ the early train to the city.", word: "catch", spec: "verb:will" },            // will catch
  { text: "If you don't write it down, you @ the address for sure.", word: "forget", spec: "verb:will" },           // will forget
]
const P21_REPORTED = [
  { text: "The teacher promised that she @ us how to solve such tasks.", word: "teach", spec: "verb:would" },       // would teach
  { text: "He said that he @ me with the project the following day.", word: "help", spec: "verb:would" },           // would help
]
const P21_WISH = [
  { text: "\"I wish I @ more free time,\" Kate sighed, looking at her homework.", word: "have", spec: "verb:past" }, // had
  { text: "I wish I @ how to swim — the warm sea looks so inviting.", word: "know", spec: "verb:past" },             // knew
]
P21_ADJ[2].answer = "more difficult"

// ── №22 · Грамматика ─────────────────────────────────────────────────────────
// Типажи по эталону (fipi_bank_eng, №22): 5.2.15 глаголы, 5.2.16 пассив, 5.2.18 модальные
// (could/could not), 5.2.13 согласование времён (would+инф.), 5.2.14 косв. речь (do→did),
// 5.2.7 условные (would+инф.), 5.2.8 I wish (could/Past), 5.2.21 мн.ч., 5.2.24 our/him,
// 5.2.25 степени (best/stricter/cheapest).
const P22_VERBS = [
  { text: "Don't disturb him now — he @ to the head teacher in her office.", word: "talk", spec: "verb:contIs" },   // is talking
  { text: "\"We @ the tickets at home!\" Dad suddenly realised at the station.", word: "leave", spec: "verb:perf" }, // have left
  { text: "As soon as she @ the good news, she phoned her mother.", word: "hear", spec: "verb:past" },               // heard
  { text: "They @ enough money with them to buy the old painting.", word: "have", spec: "verb:negpast" },            // did not have
  { text: "My best friends @ always ready to help me with difficult maths.", word: "be", spec: "verb:are" },         // are
  { text: "When the phone rang, I @ a letter to my grandparents.", word: "write", spec: "verb:contWas" },            // was writing
  { text: "My grandmother always @ me with a piece of good advice.", word: "help", spec: "verb:s" },                 // helps
  { text: "The tourists @ at the beautiful old castle for a long time.", word: "look", spec: "verb:past" },          // looked
]
const P22_PASSIVE = [
  { text: "This elegant dress @ by a famous designer many years ago.", word: "make", spec: "verb:passWas" },         // was made
  { text: "The top of the mountain @ with snow almost all year round.", word: "cover", spec: "verb:passWas" },       // was covered
  { text: "The parcel @ very carefully before it was sent abroad.", word: "pack", spec: "verb:passWas" },            // was packed
]
const P22_MODAL = [
  { text: "The room was completely dark and Tom @ find the light switch.", word: "can", spec: "modal:couldNeg" },    // could not
  { text: "After years of practice she @ play the violin beautifully.", word: "can", spec: "modal:could" },          // could
]
const P22_SEQ = [
  { text: "Mum said that she @ us a lift to the stadium after lunch.", word: "give", spec: "verb:would" },           // would give
  { text: "He promised that he @ to the party without fail this time.", word: "come", spec: "verb:would" },          // would come
]
const P22_REPORTED = [
  { text: "The teacher asked me what I @ during the long summer holidays.", word: "do", spec: "verb:past" },         // did
]
const P22_COND = [
  { text: "If I had a little more time, I @ you to finish the drawing.", word: "allow", spec: "verb:would" },        // would allow
]
const P22_WISH = [
  { text: "I wish I @ speak three languages the way my cousin does.", word: "can", spec: "modal:could" },            // could
  { text: "I wish she @ a little more about protecting the environment.", word: "care", spec: "verb:past" },         // cared
]
const P22_PLURAL = [
  { text: "In summer the whole meadow is full of colourful @.", word: "butterfly", spec: "plural" },                 // butterflies
]
const P22_PRON = [
  { text: "We invited all @ classmates to the big birthday party.", word: "we", spec: "pron:det" },                  // our
  { text: "David was ill last week, so the teacher gave @ some extra time.", word: "he", spec: "pron:obj" },         // him
]
const P22_ADJ = [
  { text: "This is the @ film I have ever seen in my whole life.", word: "good", spec: "sup" },                      // best
  { text: "Our new form teacher is @ than the previous one.", word: "strict", spec: "comp" },                        // stricter
  { text: "We chose the @ hotel in town because we had little money.", word: "cheap", spec: "sup" },                 // cheapest
]

// ── №23 · Грамматика ─────────────────────────────────────────────────────────
// Типажи по эталону (fipi_bank_eng, №23): 5.2.15 глаголы, 5.2.16 пассив (прош. + наст.),
// 5.2.18 could not, 5.2.13 согл. времён (was/would+инф.), 5.2.7 First Conditional
// (will/3sg/are), 5.2.8 I wish (had/could), 5.2.21 мн.ч., 5.2.24 местоимения, 5.2.25
// степени, 5.2.26 сравнит. наречие (better), 5.2.27 порядковые.
const P23_VERBS = [
  { text: "Ann @ the soup because it was much too salty for her taste.", word: "like", spec: "verb:negpast" },       // did not like
  { text: "The girls @ quietly in the corner when the teacher came in.", word: "chat", spec: "verb:contWere" },      // were chatting
  { text: "Suddenly we @ a strange noise coming from behind the door.", word: "hear", spec: "verb:past" },           // heard
  { text: "At nine o'clock last night he @ his favourite show on TV.", word: "watch", spec: "verb:contWas" },        // was watching
  { text: "\"I'm so sorry, I @ to bring your book back today,\" said Ben.", word: "forget", spec: "verb:past" },      // forgot
  { text: "The shops @ closed because of the national holiday on Monday.", word: "be", spec: "verb:pastPl" },         // were
  { text: "My baby brother usually @ for about two hours after lunch.", word: "sleep", spec: "verb:s" },             // sleeps
]
const P23_PASSIVE = [
  { text: "The whole field @ with fresh white snow early this morning.", word: "cover", spec: "verb:passWas" },      // was covered
  { text: "This stone bridge @ more than a hundred years ago.", word: "build", spec: "verb:passWas" },               // was built
  { text: "Nowadays computers @ in almost every school around the country.", word: "use", spec: "verb:passAre" },    // are used
]
const P23_MODAL = [
  { text: "The box was too heavy, and the little boy @ lift it at all.", word: "can", spec: "modal:couldNeg" },      // could not
]
const P23_SEQ = [
  { text: "She told me that the weather @ awful during her whole trip.", word: "be", spec: "verb:past" },            // was
  { text: "He said that he @ a photo of the mountain especially for me.", word: "take", spec: "verb:would" },        // would take
]
const P23_PLURAL = [
  { text: "Two young @ were pushing prams along the sunny park path.", word: "woman", spec: "plural" },              // women
  { text: "All the @ in the group enjoyed the funny puppet show.", word: "child", spec: "plural" },                  // children
  { text: "In the nursery three tiny @ were sleeping peacefully.", word: "baby", spec: "plural" },                   // babies
  { text: "My new shoes were too tight and my @ hurt all day long.", word: "foot", spec: "plural" },                 // feet
]
const P23_PRON = [
  { text: "Kate lost @ umbrella somewhere on the way to school.", word: "she", spec: "pron:det" },                   // her
  { text: "Please wait for @ near the main entrance after the lesson.", word: "i", spec: "pron:obj" },               // me
  { text: "We proudly showed the guests around @ new flat.", word: "we", spec: "pron:det" },                         // our
  { text: "The players warmly thanked @ coach after the match.", word: "they", spec: "pron:det" },                   // their
]
const P23_ADJ = [
  { text: "Tom is the @ pupil in our class, but also one of the tallest.", word: "young", spec: "sup" },             // youngest
  { text: "That was the @ summer holiday we have ever had together.", word: "good", spec: "sup" },                   // best
]
const P23_ADV = [
  { text: "After a week of rest by the sea she felt @ than before.", word: "well", spec: "advcomp" },                // better
]
const P23_NUM = [
  { text: "Thursday is the @ day of the week in most calendars.", word: "four", spec: "ord" },                       // fourth
  { text: "February is the @ month of the year and the shortest one.", word: "two", spec: "ord" },                   // second
]
const P23_COND = [
  { text: "If it finally stops raining, we @ for a long walk in the woods.", word: "go", spec: "verb:will" },        // will go
  { text: "If he @ his time well, he will easily pass the exam.", word: "manage", spec: "verb:s" },                  // manages
  { text: "If you @ ready now, we can start the lesson at once.", word: "be", spec: "verb:are" },                    // are
]
const P23_WISH = [
  { text: "I wish I @ a bike as fast and shiny as my friend's.", word: "have", spec: "verb:past" },                  // had
  { text: "I wish I @ come to your birthday party last Saturday.", word: "can", spec: "modal:could" },               // could
]

// ── №24 · Грамматика ─────────────────────────────────────────────────────────
// Типажи по эталону (fipi_bank_eng, №24): 5.2.15 глаголы, 5.2.16 пассив, 5.2.18 could not,
// 5.2.13 согл. времён (would), 5.2.7 условные (if-past / will), 5.2.8 I wish (could),
// 5.2.21 мн.ч. (mice/children), 5.2.24 местоимения (det/obj/pos mine/refl himself),
// 5.2.25 степени (в т.ч. многосложные most important/most communicative).
const P24_VERBS = [
  { text: "When mum came into the room, I @ a book about dinosaurs.", word: "read", spec: "verb:contWas" },          // was reading
  { text: "\"They @ home already,\" she said with a sigh of relief.", word: "come", spec: "verb:perf" },             // have come
  { text: "At that very moment the pupils @ a difficult dictation.", word: "write", spec: "verb:contWere" },         // were writing
  { text: "He @ absolutely nothing and quietly left the room.", word: "say", spec: "verb:past" },                    // said
  { text: "By the evening we @ all the main sights of the old city.", word: "see", spec: "verb:pastperf" },          // had seen
  { text: "I @ all my homework, so now I can relax for a while.", word: "do", spec: "verb:perf" },                   // have done
  { text: "Don't worry — I @ you the very moment I arrive there.", word: "call", spec: "verb:will" },                // will call
]
const P24_PASSIVE = [
  { text: "All the shops in the street @ because of the storm warning.", word: "close", spec: "verb:passWere" },     // were closed
  { text: "This lovely wooden toy @ by my grandfather long ago.", word: "make", spec: "verb:passWas" },              // was made
]
const P24_MODAL = [
  { text: "It was raining really hard, so we @ go outside to play.", word: "can", spec: "modal:couldNeg" },          // could not
]
const P24_SEQ = [
  { text: "She said that she @ me pack my things for the long trip.", word: "help", spec: "verb:would" },            // would help
  { text: "The manager promised that he @ us to visit the factory.", word: "allow", spec: "verb:would" },            // would allow
  { text: "Tom said that he @ to the seaside with his family in July.", word: "go", spec: "verb:would" },            // would go
]
const P24_COND = [
  { text: "If I @ a little more money, I would buy that mountain bike.", word: "have", spec: "verb:past" },          // had
  { text: "If you give me a pen, I @ down the address for you.", word: "write", spec: "verb:will" },                 // will write
]
const P24_WISH = [
  { text: "I wish I @ paint pictures as well as my talented sister.", word: "can", spec: "modal:could" },            // could
]
const P24_PLURAL = [
  { text: "The old empty house was full of tiny grey @.", word: "mouse", spec: "plural" },                           // mice
  { text: "The @ happily built a huge sandcastle on the beach.", word: "child", spec: "plural" },                    // children
]
const P24_PRON = [
  { text: "The whole team proudly celebrated @ well-deserved victory.", word: "they", spec: "pron:det" },           // their
  { text: "This umbrella isn't yours — I'm sure it is @.", word: "i", spec: "pron:pos" },                            // mine
  { text: "Peter is very independent and fixed the old bike all by @.", word: "he", spec: "pron:refl" },             // himself
  { text: "On the trip grandpa told @ a wonderful story about the sea.", word: "we", spec: "pron:obj" },             // us
  { text: "Kate clearly needed some help, so I quietly sat next to @.", word: "she", spec: "pron:obj" },             // her
]
const P24_ADJ = [
  { text: "Ann is the @ girl in our class — she talks to everyone.", word: "communicative", spec: "sup", skipCheck: true }, // most communicative
  { text: "Good health is the @ thing in a person's whole life.", word: "important", spec: "sup", skipCheck: true }, // most important
  { text: "My younger brother is two years @ than me.", word: "young", spec: "comp" },                               // younger
  { text: "This is honestly the @ cake I have ever tried.", word: "good", spec: "sup" },                             // best
  { text: "The Sun is by far the @ star we can see in our sky.", word: "bright", spec: "sup" },                      // brightest
]
const P24_NUM = [
  { text: "Sunday is often called the @ day of the week in the calendar.", word: "one", spec: "ord" },               // first
  { text: "Thursday is the @ working day for most school pupils.", word: "four", spec: "ord" },                      // fourth
]
P24_ADJ[0].answer = "most communicative"
P24_ADJ[1].answer = "most important"

// ── №25 · Грамматика ─────────────────────────────────────────────────────────
// Типажи по эталону (fipi_bank_eng, №25): 5.2.15 глаголы, 5.2.16 пассив (разные времена),
// 5.2.18 could not, 5.2.20 герундий (V-ing), 5.2.13 согл. времён (would have/had+pp),
// 5.2.14 was, 5.2.7 условные (would go), 5.2.8 I wish (were/could), 5.2.21 мн.ч.
// (women/photos/policemen), 5.2.24 (myself/her/our/us), 5.2.25 степени (worse/most wonderful),
// 5.2.26 наречия, 5.2.27 порядковые.
const P25_VERBS = [
  { text: "At first Kate @ the answer, so she asked her teacher for help.", word: "know", spec: "verb:negpast" },    // did not know
  { text: "My cousins @ very fond of collecting old coins and stamps.", word: "be", spec: "verb:are" },              // are
  { text: "Please be patient — I @ a cake for the party right now.", word: "make", spec: "verb:contAm" },            // am making
  { text: "\"We @ a real effort to finish the project,\" the pupils said.", word: "make", spec: "verb:perf" },       // have made
  { text: "When the bell rang, the students @ their final essays.", word: "write", spec: "verb:contWere" },          // were writing
  { text: "Look — the little kitten @ from its own bowl for the first time.", word: "eat", spec: "verb:contIs" },    // is eating
  { text: "The children @ when the teacher explained the new rule.", word: "protest", spec: "verb:negpast" },        // did not protest
]
const P25_PASSIVE = [
  { text: "This exciting novel @ more than fifty years ago.", word: "publish", spec: "verb:passWas" },               // was published
  { text: "The letter @ by hand in beautiful old-fashioned handwriting.", word: "write", spec: "verb:passWas" },     // was written
  { text: "Delicious cakes @ at this small bakery every single morning.", word: "make", spec: "verb:passAre" },      // are made
  { text: "Dinner @ in the garden because the evening was so warm.", word: "serve", spec: "verb:passWas" },          // was served
  { text: "The whole hall @ with flowers for the wedding ceremony.", word: "decorate", spec: "verb:passWas" },       // was decorated
]
const P25_MODAL = [
  { text: "The knot was very tight and the sailor @ untie it quickly.", word: "can", spec: "modal:couldNeg" },       // could not
]
const P25_GERUND = [
  { text: "Tom is really looking forward to @ his old friends again.", word: "meet", spec: "verb:ing" },             // meeting
  { text: "Thank you for @ me with the heavy suitcases yesterday.", word: "help", spec: "verb:ing" },                // helping
]
const P25_SEQ = [
  { text: "Mum promised that she @ me the money for the school trip.", word: "give", spec: "verb:would" },           // would give (согл. времён)
  { text: "She thanked me warmly because I @ her with the difficult task.", word: "help", spec: "verb:pastperf" },   // had helped
]
const P25_REPORTED = [
  { text: "She told everyone that the concert @ absolutely wonderful.", word: "be", spec: "verb:past" },             // was
]
const P25_COND = [
  { text: "If I had a free ticket, I @ to the theatre this evening.", word: "go", spec: "verb:would" },              // would go
]
const P25_WISH = [
  { text: "I wish it @ warmer today so that we could go swimming.", word: "be", spec: "verb:pastPl" },               // were
  { text: "I wish I @ play the guitar as well as my elder brother.", word: "can", spec: "modal:could" },             // could
]
const P25_PLURAL = [
  { text: "Several @ were selling flowers near the railway station.", word: "woman", spec: "plural" },               // women
  { text: "Kate showed us dozens of @ from her summer holiday.", word: "photo", spec: "plural" },                    // photos
  { text: "Two @ were helping the tourists find the right street.", word: "policeman", spec: "plural" },             // policemen
]
const P25_PRON = [
  { text: "Sarah made the whole birthday cake all by @.", word: "she", spec: "pron:refl" },                          // herself
  { text: "The teacher gave @ some useful advice about the exam.", word: "we", spec: "pron:obj" },                   // us
  { text: "The dog wagged @ tail happily when its owner came home.", word: "it", spec: "pron:det" },                 // its
]
const P25_ADJ = [
  { text: "The traffic today is even @ than it was yesterday morning.", word: "bad", spec: "comp" },                 // worse
  { text: "It was the @ concert I have ever been to in my life.", word: "wonderful", spec: "sup", skipCheck: true }, // most wonderful
  { text: "I feel a lot @ now that the exams are finally over.", word: "good", spec: "comp" },                       // better
]
const P25_ADV = [
  { text: "Since she started running, she sleeps much @ than before.", word: "well", spec: "advcomp" },              // better
  { text: "Try to arrive a bit @ tomorrow so we don't miss the bus.", word: "early", spec: "advcomp" },              // earlier
]
const P25_NUM = [
  { text: "October is the @ month of the year in our calendar.", word: "ten", spec: "ord" },                         // tenth
  { text: "He finished the race in the @ place out of thirty runners.", word: "five", spec: "ord" },                 // fifth
]
P25_ADJ[1].answer = "most wonderful"

// ── №26 · Грамматика ─────────────────────────────────────────────────────────
// Типажи по эталону (fipi_bank_eng, №26): 5.2.15 глаголы (в т.ч. отриц. Present Perfect),
// 5.2.16 пассив (were/is/was/are), 5.2.18 модальный (needed), 5.2.19 будущее (going to → will),
// 5.2.14 would tell, 5.2.7 условные (would not be / will), 5.2.8 could, 5.2.21 мн.ч.
// (gentlemen/knives/children), 5.2.24 me/them/him, 5.2.25 younger/coldest, 5.2.26 later,
// 5.2.27 порядковые.
const P26_VERBS = [
  { text: "Don't worry — I @ you back as soon as I finish work.", word: "call", spec: "verb:will" },                 // will call
  { text: "\"I @ this film three times, and I still love it,\" said Ann.", word: "see", spec: "verb:perf" },         // have seen
  { text: "Ben @ the mistake in his essay until the teacher showed it.", word: "notice", spec: "verb:negpast" },     // did not notice
  { text: "My grandfather @ in the same factory for over thirty years.", word: "work", spec: "verb:s" },             // works
  { text: "As she opened the door, she @ a strange light in the sky.", word: "see", spec: "verb:past" },             // saw
  { text: "\"We @ our lost dog anywhere yet,\" the children said sadly.", word: "find", spec: "verb:negperf" },      // have not found
]
const P26_PASSIVE = [
  { text: "These colourful posters @ specially for the school concert.", word: "print", spec: "verb:passWere" },     // were printed
  { text: "The message @ in an old and unusual kind of code.", word: "write", spec: "verb:passIs" },                 // is written
  { text: "The main gate @ every night at exactly ten o'clock.", word: "lock", spec: "verb:passIs" },                // is locked
  { text: "This beautiful picture @ by a famous artist a century ago.", word: "draw", spec: "verb:passWas" },        // was drawn
  { text: "Dogs @ in this park only if they are kept on a lead.", word: "allow", spec: "verb:passAre" },             // are allowed
]
const P26_MODAL = [
  { text: "The room was cold, so we @ to turn the heating on.", word: "need", spec: "verb:past" },                   // needed
]
const P26_FUTURE = [
  { text: "The coach is sure that the team @ a lot before the final.", word: "improve", spec: "verb:will" },         // will improve
]
const P26_REPORTED = [
  { text: "She said that she @ me the truth about the accident later.", word: "tell", spec: "verb:would" },          // would tell
]
const P26_COND = [
  { text: "Without your kind help, the whole project @ ready in time.", word: "be", spec: "verb:negwould" },         // would not be
  { text: "If you ask him politely, he @ you a hand with the boxes.", word: "give", spec: "verb:will" },             // will give
  { text: "If it snows tomorrow, we @ a lot of fun in the park.", word: "have", spec: "verb:will" },                 // will have
]
const P26_WISH = [
  { text: "I wish I @ speak in public without feeling so nervous.", word: "can", spec: "modal:could" },              // could
]
const P26_PLURAL = [
  { text: "Two elderly @ were sitting quietly on the park bench.", word: "gentleman", spec: "plural" },              // gentlemen
  { text: "The cook sharpened all the @ before starting to cook.", word: "knife", spec: "plural" },                  // knives
  { text: "All the @ in the camp took part in the treasure hunt.", word: "child", spec: "plural" },                  // children
]
const P26_PRON = [
  { text: "Sam waved at @ from the other side of the busy street.", word: "i", spec: "pron:obj" },                   // me
  { text: "The apples looked ripe, so we happily picked @.", word: "they", spec: "pron:obj" },                       // them
  { text: "Peter was upset, so his friends tried to cheer @ up.", word: "he", spec: "pron:obj" },                    // him
]
const P26_ADJ = [
  { text: "My sister is two years @ than me, but she is taller.", word: "young", spec: "comp" },                     // younger
  { text: "Yesterday was the @ day of the whole winter so far.", word: "cold", spec: "sup" },                        // coldest
]
const P26_ADV = [
  { text: "The train arrived ten minutes @ than the timetable said.", word: "late", spec: "advcomp" },               // later
]
const P26_NUM = [
  { text: "May is the @ month of spring in the northern countries.", word: "three", spec: "ord" },                   // third
  { text: "He was the @ pupil to hand in the finished test.", word: "one", spec: "ord" },                            // first
]
// ── №27 · Грамматика ─────────────────────────────────────────────────────────
// Типажи по эталону (fipi_bank_eng, №27): 5.2.15 глаголы, 5.2.16 пассив, 5.2.13 would go,
// 5.2.14 had to, 5.2.7 условные (knew/will), 5.2.8 I wish (could/knew/had), 5.2.24 him/us/her/
// their, 5.2.25 largest/better, 5.2.27 порядковые. (В эталоне №27 нет модальных/мн.ч./наречий.)
const P27_VERBS = [
  { text: "The postman always @ to our house at about nine in the morning.", word: "come", spec: "verb:s" },        // comes
  { text: "When we looked up, hundreds of birds @ over the calm lake.", word: "fly", spec: "verb:contWere" },        // were flying
  { text: "\"We @ pizza for the whole class,\" said the waiter with a smile.", word: "order", spec: "verb:perf" },   // have ordered
  { text: "It @ to me whether we win or lose — I just enjoy the game.", word: "matter", spec: "verb:negpres3" },     // does not matter
  { text: "Hurry up! The planes @ on the runway at this very moment.", word: "land", spec: "verb:contAre" },         // are landing
  { text: "At noon yesterday I @ lunch in the school canteen with friends.", word: "eat", spec: "verb:contWas" },    // was eating
  { text: "If you ever get lost, I @ you find the way back home.", word: "help", spec: "verb:will" },                // will help
]
const P27_PASSIVE = [
  { text: "This old clock @ at a street market many years ago.", word: "buy", spec: "verb:passWas" },                // was bought
  { text: "The vase @ when the cat jumped onto the top shelf.", word: "break", spec: "verb:passWas" },               // was broken
  { text: "Wooden toys @ by hand in this little village workshop.", word: "make", spec: "verb:passAre" },            // are made
  { text: "The stage @ with bright lights for the evening show.", word: "decorate", spec: "verb:passWas" },          // was decorated
]
const P27_SEQ = [
  { text: "Peter said that he @ to the mountains with his family in August.", word: "go", spec: "verb:would" },      // would go
]
const P27_REPORTED = [
  { text: "The teacher said that we @ finish the whole project at home.", word: "have", spec: "verb:past", answer: "had to", skipCheck: true }, // had to
]
const P27_COND = [
  { text: "If I @ his phone number, I would call him straight away.", word: "know", spec: "verb:past" },             // knew
  { text: "If the sky stays clear tonight, it @ very cold by morning.", word: "be", spec: "verb:will" },             // will be
  { text: "If you invite them nicely, they @ to the party for sure.", word: "come", spec: "verb:will" },             // will come
]
const P27_WISH = [
  { text: "I wish I @ swim as fast and confidently as the older boys.", word: "can", spec: "modal:could" },          // could
  { text: "I wish I @ the answer to this really tricky question.", word: "know", spec: "verb:past" },                // knew
  { text: "I wish I @ more free time to read books during the week.", word: "have", spec: "verb:past" },             // had
]
const P27_PRON = [
  { text: "David called earlier, so I promised to ring @ back tonight.", word: "he", spec: "pron:obj" },             // him
  { text: "The friendly guide showed @ the oldest part of the castle.", word: "we", spec: "pron:obj" },              // us
  { text: "Kate has left @ warm scarf on the school bus again.", word: "she", spec: "pron:det" },                    // her
  { text: "The two teams shook hands after @ exciting football match.", word: "they", spec: "pron:det" },            // their
]
const P27_ADJ = [
  { text: "The Pacific is by far the @ ocean on our whole planet.", word: "large", spec: "sup" },                    // largest
  { text: "My new school is @ than the one I used to go to.", word: "good", spec: "comp" },                          // better
]
const P27_NUM = [
  { text: "Tuesday is the @ day of the week in the English calendar.", word: "two", spec: "ord" },                   // second
]

// ── №28 · Грамматика ─────────────────────────────────────────────────────────
// Типажи по эталону (fipi_bank_eng, №28): 5.2.15 глаголы, 5.2.16 пассив, 5.2.18 could not/
// cannot, 5.2.14 liked, 5.2.7 условные (were/will ask), 5.2.8 I wish (could/were/had),
// 5.2.21 мн.ч. (women/policemen), 5.2.24 them/us/their, 5.2.25 oldest/better, 5.2.27 порядковые.
const P28_VERBS = [
  { text: "For a moment nobody spoke — everyone @ about the sad news.", word: "think", spec: "verb:past" },          // thought
  { text: "Give me a ring later and we @ about the weekend plans.", word: "chat", spec: "verb:will" },               // will chat
  { text: "As soon as the music started, the whole hall @ to dance.", word: "begin", spec: "verb:past" },            // began
  { text: "\"Our team @ the cup twice this year!\" the boys shouted.", word: "win", spec: "verb:perf" },             // have won
  { text: "She @ the little kitten the moment she saw it in the shop.", word: "love", spec: "verb:past" },           // loved
]
const P28_PASSIVE = [
  { text: "The invitations @ on beautiful golden paper last week.", word: "print", spec: "verb:passWere" },          // were printed
  { text: "This famous poem @ more than two hundred years ago.", word: "write", spec: "verb:passWas" },              // was written
  { text: "The classroom @ with balloons for the end-of-year party.", word: "decorate", spec: "verb:passWas" },      // was decorated
]
const P28_MODAL = [
  { text: "The path was covered in ice, so the old man @ walk fast.", word: "can", spec: "modal:couldNeg" },         // could not
  { text: "\"I'm sorry, but I @ help you with this right now,\" she said.", word: "can", spec: "modal:canNeg" },     // cannot
]
const P28_REPORTED = [
  { text: "Ben told his mother that he @ the new adventure film a lot.", word: "like", spec: "verb:past" },          // liked
]
const P28_COND = [
  { text: "If the twins @ here now, they would help us paint the fence.", word: "be", spec: "verb:pastPl" },         // were
  { text: "If you are not sure, I @ the teacher for you after class.", word: "ask", spec: "verb:will" },             // will ask
]
const P28_WISH = [
  { text: "I wish I @ ride a horse the way my country cousins do.", word: "can", spec: "modal:could" },              // could
  { text: "I wish my best friend @ in the same class as me.", word: "be", spec: "verb:pastPl" },                     // were
  { text: "I wish I @ a bigger room for all my books and games.", word: "have", spec: "verb:past" },                 // had
]
const P28_PLURAL = [
  { text: "Several @ were chatting near the entrance to the theatre.", word: "woman", spec: "plural" },              // women
  { text: "Two @ were directing the traffic at the busy crossroads.", word: "policeman", spec: "plural" },           // policemen
]
const P28_PRON = [
  { text: "The berries were ripe, so the children happily picked @.", word: "they", spec: "pron:obj" },              // them
  { text: "The old sailor told @ an amazing story about a storm.", word: "we", spec: "pron:obj" },                   // us
  { text: "The pupils were proud of @ project on rare animals.", word: "they", spec: "pron:det" },                   // their
]
const P28_ADJ = [
  { text: "My grandfather is the @ member of our large family.", word: "old", spec: "sup" },                         // oldest
  { text: "Today I feel @ than I did during the whole last week.", word: "good", spec: "comp" },                     // better
]
const P28_NUM = [
  { text: "January is the @ month of the year in every calendar.", word: "one", spec: "ord" },                       // first
]

// ── №29 · Словообразование (лексико-грамматика) ──────────────────────────────
// КЭС 5.3.6 (аффиксы). Словообразование правилом надёжно не выводится (inform→information,
// beauty→beautiful, possible→impossible, science→scientist), поэтому пары основа→ответ
// заданы ЯВНО (answer + skipCheck) — по образцу реального спектра аффиксов эталона №29.
// wf(word, answer, text) — краткий конструктор словообразовательного элемента.
const wf = (word, answer, text) => ({ word, answer, text, spec: "wordform", skipCheck: true })
const P29_NOUN = [
  wf("inform", "information", "A hundred years ago people got most of their @ from newspapers."),
  wf("collect", "collection", "At the museum he proudly showed us his @ of ancient coins."),
  wf("imagine", "imagination", "Writing stories is a wonderful way to develop your @."),
  wf("visit", "visitor", "Every @ to the old castle receives a free map at the entrance."),
  wf("design", "designer", "This elegant evening dress was created by a famous @."),
  wf("science", "scientist", "Ever since childhood she has dreamt of becoming a @."),
  wf("develop", "development", "Our small town has seen rapid @ over the last ten years."),
  wf("report", "reporter", "A young @ asked the football players several quick questions."),
  wf("active", "activity", "Swimming is her favourite weekend @ in the summer."),          // -ity (ФИПИ 2.3.7.1)
  wf("popular", "popularity", "The band gained huge @ after their first concert."),        // -ity
]
const P29_ADJ = [
  wf("tradition", "traditional", "Borscht is a @ Russian dish that many families cook at home."),
  wf("nation", "national", "The museum has a huge @ collection of old paintings."),
  wf("danger", "dangerous", "Swimming in this fast mountain river can be very @."),
  wf("fame", "famous", "Leonardo da Vinci was a @ Italian artist and inventor."),
  wf("differ", "different", "People often have completely @ opinions about the same film."),
  wf("rain", "rainy", "Take an umbrella with you — it's a cold and @ day today."),
  wf("noise", "noisy", "The classroom was @ until the teacher finally came in."),
  wf("comfort", "comfortable", "The new armchair is soft, warm and extremely @."),
  wf("beauty", "beautiful", "From the hill we watched a @ sunset over the calm sea."),
  wf("use", "useful", "This little dictionary is really @ for learning new words."),
  wf("impress", "impressive", "The ancient castle on the rock looked huge and truly @."),
  wf("amaze", "amazing", "We had an absolutely @ time at the summer sports camp."),
  wf("interest", "interesting", "The lecture about space was long but very @."),
  wf("Europe", "European", "Paris is one of the largest @ capital cities."),
  wf("nature", "natural", "This quiet park is full of @ beauty in every season."),
  wf("wealth", "wealthy", "The @ merchant built a huge house in the centre of town."),
]
const P29_ADV = [
  wf("rare", "rarely", "My grandfather is very healthy and @ catches a cold."),
  wf("fortunate", "unfortunately", "@, the concert was cancelled because of the storm."),
  wf("usual", "usually", "On Sundays we @ have a big family breakfast together."),
]
const P29_NEG = [
  wf("fair", "unfair", "The pupils thought it was completely @ to cancel the trip."),
  wf("possible", "impossible", "Without a proper map it was almost @ to find the path."),
  wf("usual", "unusual", "Seeing snow in this warm country is a truly @ event."),
]

// ── №30–34 · Словообразование (продолжение) ──────────────────────────────────
// КЭС 5.3.6. Те же принципы, что и №29: пары основа→ответ заданы явно (wf, skipCheck).
// По каждому номеру покрыты семьи аффиксов из его эталона: сущ. (-tion/-ment/-ship/-ness/
// -ence/-er/-or/-ian/-al), прил. (-al/-ous/-ful/-y/-able/-ive/-ing/-ed/-less), нареч. (-ly),
// отрицание (un-/im-/in-/dis-).
const P30_NOUN = [
  wf("celebrate", "celebration", "The whole town came to the @ of the anniversary."),
  wf("attract", "attraction", "The old lighthouse is the main tourist @ of the town."),
  wf("educate", "education", "A good @ opens many doors later in life."),
  wf("entertain", "entertainment", "The cruise ship offers lots of @ for children."),
  wf("govern", "government", "The @ promised to build new roads and schools."),
  wf("friend", "friendship", "Their @ began at school and lasted for many years."),
  wf("differ", "difference", "Can you spot the @ between these two pictures?"),
  wf("compose", "composer", "Tchaikovsky is a world-famous Russian @."),
  wf("swim", "swimmer", "She trains every day and is a very strong @."),
]
const P30_ADJ = [
  wf("wonder", "wonderful", "We had a @ time at the seaside last summer."),
  wf("culture", "cultural", "The city has a rich @ life with many theatres."),
  wf("nature", "natural", "The lake is surrounded by amazing @ beauty."),
  wf("vary", "various", "The shop sells @ kinds of tea from around the world."),
  wf("effect", "effective", "Regular practice is the most @ way to learn a language."),
  wf("end", "endless", "From the plane the desert looked flat and @."),
  wf("luck", "lucky", "You were very @ to catch the last train home."),
  wf("bore", "boring", "The film was so @ that I fell asleep halfway through."),
]
const P30_ADV = [
  wf("absolute", "absolutely", "The view from the top was @ breathtaking."),
  wf("exact", "exactly", "The train left @ on time, at nine o'clock."),
  wf("serious", "seriously", "She takes her music lessons very @."),
]
const P30_NEG = [
  wf("possible", "impossible", "The rules made it @ to enter without a ticket."),
  wf("luck", "unlucky", "It is considered @ to walk under a ladder."),
  wf("agree", "disagree", "The two friends often @ about football teams."),
  wf("approve", "disapprove", "My parents strongly @ of watching TV late at night."),
]
const P31_NOUN = [
  wf("begin", "beginning", "At the @ of the story the hero lives in a village."),
  wf("direct", "direction", "We took the wrong @ and got completely lost."),
  wf("explore", "explorer", "The famous @ crossed the icy continent on foot."),
  wf("garden", "gardener", "Our @ grows the most beautiful roses in the street."),
  wf("know", "knowledge", "Her @ of history really impressed the teacher."),
  wf("politics", "politician", "The young @ promised to help ordinary families."),
  wf("populate", "population", "The @ of the town has doubled in ten years."),
  wf("protect", "protection", "Sun cream gives good @ against strong sunlight."),
  wf("real", "reality", "After years of hard work, her dream finally became a @."),         // -ity (ФИПИ 2.3.7.1)
]
const P31_ADJ = [
  wf("comfort", "comfortable", "The hotel bed was soft and extremely @."),
  wf("create", "creative", "Art lessons help children become more @."),
  wf("danger", "dangerous", "It is @ to cross the road without looking."),
  wf("educate", "educational", "The trip to the museum was fun and @."),
  wf("excite", "exciting", "The final match was the most @ game of the season."),
  wf("taste", "tasty", "Grandma always cooks something warm and @."),
  wf("success", "successful", "Her first book was a @ bestseller."),
]
const P31_ADV = [
  wf("actual", "actually", "I thought it was hard, but it was @ quite easy."),
  wf("extreme", "extremely", "The winters here are @ cold and snowy."),
  wf("fluent", "fluently", "After a year in London he spoke English @."),
  wf("regular", "regularly", "If you train @, you will soon get stronger."),
]
const P31_NEG = [
  wf("fair", "unfair", "The pupils felt it was @ to give homework at the weekend."),
  wf("possible", "impossible", "In thick fog it was @ to see the mountains."),
  wf("usual", "unusual", "Snow in April is quite @ in this region."),
  wf("forget", "unforgettable", "The concert was truly @ — the best I've been to."),
]
const P32_NOUN = [
  wf("collect", "collection", "The gallery has a huge @ of modern paintings."),
  wf("combine", "combination", "This dish is a tasty @ of rice and vegetables."),
  wf("equip", "equipment", "The climbers checked all their @ before the trip."),
  wf("explain", "explanation", "The teacher gave a clear @ of the difficult rule."),
  wf("kind", "kindness", "She thanked the stranger for his @ and help."),
  wf("teach", "teacher", "Our English @ makes every lesson interesting."),
  wf("farm", "farmer", "The @ gets up early to feed all the animals."),
]
const P32_ADJ = [
  wf("attract", "attractive", "The town centre looked bright and @ at night."),
  wf("expense", "expensive", "This restaurant is famous but rather @."),
  wf("music", "musical", "The children put on a wonderful @ show."),
  wf("nerve", "nervous", "She felt @ before the important exam."),
  wf("person", "personal", "Please don't read my @ letters."),
  wf("profession", "professional", "He takes brilliant @ photographs of wildlife."),
  wf("stress", "stressful", "Moving to a new house can be very @."),
  wf("talent", "talented", "The young singer is really @."),
]
const P32_ADV = [
  wf("proper", "properly", "Make sure you close the door @ before leaving."),
  wf("recent", "recently", "They have @ moved to a bigger flat."),
]
const P32_NEG = [
  wf("please", "unpleasant", "There was an @ smell coming from the old fridge."),
  wf("possible", "impossible", "Without your help it would have been @ to finish."),
  wf("agree", "disagree", "Experts still @ about the cause of the problem."),
]
const P33_NOUN = [
  wf("arrive", "arrival", "The @ of the guests was delayed by the storm."),
  wf("art", "artist", "The young @ painted a portrait of his grandmother."),
  wf("champion", "championship", "Our school won the regional chess @."),
  wf("communicate", "communication", "The internet has changed the way we @... use @."),
  wf("drive", "driver", "The bus @ waited patiently for the last passenger."),
  wf("please", "pleasure", "It was a great @ to meet you at last."),
  wf("safe", "safety", "For your @, please keep your seatbelt on."),
  wf("situate", "situation", "The teacher handled the difficult @ calmly."),
  wf("train", "trainer", "Their new football @ is very strict but fair."),
  wf("electric", "electricity", "The heavy storm cut off the @ in the whole village."),      // -ity (ФИПИ 2.3.7.1)
]
const P33_ADJ = [
  wf("amaze", "amazing", "From the hill we had an @ view of the whole valley."),
  wf("care", "careful", "Please be @ — the floor is wet and slippery."),
  wf("charm", "charming", "The old village was small and absolutely @."),
  wf("health", "healthy", "Eating fruit and vegetables keeps you @."),
  wf("help", "helpless", "The tiny kitten looked cold and @."),
  wf("practice", "practical", "She gave me some @ advice about the trip."),
  wf("skill", "skillful", "The @ sailor guided the boat through the storm."),
  wf("taste", "tasteless", "Without salt the soup was completely @."),
]
const P33_ADV = [
  wf("comfort", "comfortably", "The cat curled up @ on the warm sofa."),
  wf("immediate", "immediately", "When the alarm rang, everyone left the building @."),
  wf("quiet", "quietly", "The children walked @ past the sleeping baby."),
  wf("tradition", "traditionally", "New Year is @ celebrated with a big family dinner."),
]
const P33_NEG = [
  wf("appear", "disappear", "Magicians can make small objects @ in a second."),
  wf("like", "dislike", "Many children @ getting up early on school days."),
  wf("possible", "impossible", "It seemed @ to solve such a difficult puzzle."),
  wf("formal", "informal", "The party was @, so nobody wore a suit."),
  wf("understand", "misunderstand", "If the note is unclear, people can easily @ it."), // mis- (ФИПИ 2.3.7.7)
]
const P34_NOUN = [
  wf("appear", "appearance", "She cares a lot about her neat @."),
  wf("communicate", "communication", "Good @ is important in every team."),
  wf("educate", "education", "He believes @ is the key to a better future."),
  wf("lonely", "loneliness", "Living far from friends can cause real @."),
  wf("travel", "traveller", "The experienced @ knew many useful tricks."),
  wf("visit", "visitor", "Each @ signed the guest book at the door."),
  wf("win", "winner", "The @ of the race got a shiny gold medal."),
  wf("write", "writer", "My favourite @ has published a new novel."),
]
const P34_ADJ = [
  wf("care", "careless", "One @ mistake spoiled the whole essay."),
  wf("ecology", "ecological", "The factory caused a serious @ problem."),
  wf("harm", "harmful", "Too much sugar is @ to your teeth."),
  wf("help", "helpful", "The shop assistant was polite and very @."),
  wf("nation", "national", "Football is almost a @ sport in this country."),
  wf("peace", "peaceful", "We spent a quiet, @ evening by the fire."),
  wf("power", "powerful", "The new engine is small but very @."),
  wf("use", "useful", "This app is really @ for planning trips."),
]
const P34_ADV = [
  wf("happy", "happily", "The children played @ in the sunny garden."),
  wf("probable", "probably", "It's cloudy, so it will @ rain this afternoon."),
  wf("fortunate", "unfortunately", "@, we missed the beginning of the play."),
]
const P34_NEG = [
  wf("agree", "disagree", "Brothers and sisters sometimes @ about small things."),
  wf("fair", "unfair", "It felt @ that only one team was praised."),
  wf("please", "unpleasant", "A cold, wet day can feel quite @."),
  wf("forget", "unforgettable", "Our trip to the mountains was simply @."),
  wf("sleep", "oversleep", "Set an alarm so that you don't @ and miss the bus."),         // over- (ФИПИ 2.3.7.7)
  wf("estimate", "underestimate", "Never @ how much time a good essay really takes."),    // under- (ФИПИ 2.3.7.7)
]
// «communication» в P33 — уберём кривой текст-заготовку
P33_NOUN[3].text = "Modern @ lets people talk across the whole world in seconds."

// ── №35–38 · Продуктивные задания (письмо и устная часть) ────────────────────
// У этих заданий НЕТ единого ключа-ответа — они оцениваются по критериям ФИПИ. Поэтому
// генерируем САМ СТИМУЛ (текст задания), а не ответ; вариативность — пул тем. answer здесь —
// краткая памятка (что оценивается), а не «правильный ответ».
const PRON = { m: "his", f: "her" }

// №35 · Письмо личного характера (ответ на письмо-стимул)
const build35 = (it) => ({
  number: 35, generated: true,
  answer: "Письмо 100–120 слов — оценивается по критериям (без единого ответа).",
  condition_text:
    `You have received an email message from your English-speaking pen-friend ${it.name}:\n\n` +
    `From: ${it.name}\nTo: Russian_friend\nSubject: ${it.subject}\n\n${it.body}\n\n` +
    `Write a message to ${it.name} and answer ${PRON[it.g]} 3 questions. ` +
    `Write 100–120 words. Remember the rules of email writing.`,
})
const P35 = [
  { key: "sport", label: "Спорт", name: "Ben", g: "m", subject: "Sports day",
    body: "…Yesterday our class took part in a school sports day, and I won the 100-metre race! I really love sport. What sports are popular among teenagers in your country? How often do you do sport? Which new sport would you like to try one day? …" },
  { key: "reading", label: "Чтение", name: "Emily", g: "f", subject: "Books",
    body: "…I have just finished a fantastic adventure book and I can't stop thinking about it. Reading is my favourite hobby. What kind of books do you enjoy reading? How many books do you usually read in a month? Do you prefer paper books or e-books, and why? …" },
  { key: "pets", label: "Питомцы", name: "Jack", g: "m", subject: "Pets",
    body: "…My family has just got a little puppy and he is so funny! Looking after him is great fun. Do you have any pets at home? What pet would you like to have in the future? Who usually takes care of the pets in your family? …" },
  { key: "travel", label: "Путешествия", name: "Kate", g: "f", subject: "Travelling",
    body: "…This summer my family and I are planning a trip to the mountains. I love travelling to new places. Which countries or cities would you like to visit? How do you prefer to travel — by train, by car or by plane? What do you usually take with you on a trip? …" },
  { key: "food", label: "Еда", name: "Tom", g: "m", subject: "Cooking",
    body: "…Yesterday I tried cooking pasta for the first time and it turned out great! I am really interested in cooking now. What is your favourite dish? How often does your family cook at home? Would you like to learn to cook, and why? …" },
  { key: "music", label: "Музыка", name: "Lucy", g: "f", subject: "Music",
    body: "…I have just been to my first live concert and it was amazing! Music means a lot to me. What kind of music do you like listening to? How often do you listen to music? Do you play any musical instrument? …" },
  { key: "freetime", label: "Свободное время", name: "Sam", g: "m", subject: "Free time",
    body: "…The weekend is coming and I can't wait to relax after a busy week. What do you usually do in your free time? How do you like to spend your weekends? Is there a new hobby you would like to take up? …" },
  { key: "school", label: "Школа", name: "Anna", g: "f", subject: "School",
    body: "…We have just started a new term and I already have a lot of homework. What is your favourite school subject and why? How many lessons do you usually have a day? What would you like to change about your school? …" },
]

// №36 · Чтение текста вслух
const build36 = (it) => ({
  number: 36, generated: true,
  answer: "Чтение вслух — оценивается фонетически (письменного ответа нет).",
  condition_text:
    "You are going to read the text aloud. You have 1.5 minutes to read the text silently, and then " +
    "be ready to read it aloud. Remember that you will not have more than 2 minutes for reading aloud.\n\n" + it.text,
})
const P36 = [
  { key: "dolphins", label: "Дельфины", text: "Dolphins are among the most intelligent animals on our planet. They live in seas and oceans all over the world and are famous for their friendly nature. Dolphins live in groups and often help each other when one of them is in danger. They communicate using a special system of sounds, and scientists believe that each dolphin even has its own name. People have known about the cleverness of dolphins for thousands of years. Today these amazing creatures continue to surprise researchers, who keep discovering new facts about their behaviour." },
  { key: "sun", label: "Солнце", text: "The Sun is the most important star for our planet. Although it looks quite small in the sky, it is actually enormous, and more than a million Earths could fit inside it. The Sun gives us light and heat, without which life on Earth would be impossible. Its energy helps plants to grow, warms the oceans and creates the weather. People have admired the Sun since ancient times, and many old cultures believed it was a powerful god. Today scientists study the Sun carefully, because understanding it helps us learn about our whole solar system." },
  { key: "chocolate", label: "Шоколад", text: "Chocolate is one of the most popular sweets in the world, but few people know how old it really is. It was first made hundreds of years ago in Central America, where people drank it as a bitter drink rather than eating it. Later, travellers brought chocolate to Europe, where sugar was added to make it sweet. For a long time only rich people could afford it. Today chocolate is enjoyed by millions of people of all ages. Scientists have even found that a small amount of dark chocolate can be good for your health." },
  { key: "library", label: "Библиотеки", text: "Libraries have existed for thousands of years and have always been special places. The very first libraries kept their books on clay tablets or rolls of paper, and only a few people were allowed to use them. Over the centuries libraries grew larger, and today some of them hold millions of books. A modern library is much more than a room full of shelves. People go there to read, to study quietly, to use computers and even to attend interesting talks. For many students a library is the best place to prepare for their exams." },
  { key: "penguins", label: "Пингвины", text: "Penguins are unusual birds because they cannot fly at all. Instead, they are excellent swimmers and spend much of their lives in the cold water of the southern oceans. On land penguins look rather clumsy and walk slowly, but in the sea they move quickly and gracefully, using their wings like flippers. Penguins live in large groups, which helps them stay warm and protect their young from danger. Parents take turns looking after their eggs and finding food. These friendly black-and-white birds have become favourites with people all around the world." },
  { key: "bicycle", label: "Велосипед", text: "The bicycle is one of the simplest and most useful machines ever invented. The first bicycles appeared about two hundred years ago, but they looked very different from the ones we ride today. They had no pedals, and riders had to push themselves along with their feet. Over the years the bicycle was improved again and again until it became fast, safe and comfortable. Today millions of people ride bicycles every day. Cycling is cheap, healthy and good for the environment, because it does not produce any smoke." },
  { key: "honey", label: "Мёд", text: "Honey is a sweet, golden food made by bees, and people have loved it since ancient times. To produce honey, bees visit thousands of flowers and collect a sweet liquid, which they carry back to their hive. There they turn it into honey and store it for the winter. Honey is not only delicious but also very useful. It gives us energy, and for centuries people have used it to treat coughs and colds. Bees are extremely important for nature, because while they collect nectar they also help plants to grow." },
  { key: "mountains", label: "Горы", text: "Mountains are among the most beautiful and mysterious places on Earth. They rise high above the land, and their tops are often covered with snow all year round. Climbing a high mountain is difficult and sometimes dangerous, but every year thousands of brave people try to reach the top. High in the mountains the air is thin and cold, and the weather can change very quickly. Yet many plants and animals have learnt to live there. For centuries mountains have attracted travellers, artists and scientists, who come to enjoy their beauty." },
]

// №37 · Условный диалог-расспрос (ответить на 6 вопросов)
const build37 = (it) => ({
  number: 37, generated: true,
  answer: "Полные ответы на 6 вопросов — оцениваются по критериям.",
  condition_text:
    "You are going to take part in a telephone survey. You have to answer six questions. Give full " +
    "answers to the questions. Remember that you have 40 seconds to answer each question.\n\n" +
    it.questions.map((q, i) => `${i + 1}. ${q}`).join("\n"),
})
const P37 = [
  { key: "reading", label: "Чтение", questions: ["How much time do you spend reading every day?", "What kind of books do you like most?", "Where do you usually get books from?", "Do you prefer reading in the morning or in the evening?", "Why do you think reading is important?", "What book would you recommend to your friends?"] },
  { key: "sport", label: "Спорт", questions: ["How often do you do sport?", "What is your favourite kind of sport?", "Where do you usually do sport?", "Do you prefer team sports or individual sports?", "Why do many teenagers enjoy sport?", "What sport would you recommend to a beginner?"] },
  { key: "food", label: "Здоровое питание", questions: ["How many meals do you usually have a day?", "What healthy food do you eat most often?", "Who usually cooks in your family?", "Do you think fast food is bad for you?", "Why is a good breakfast important?", "What advice would you give to someone who wants to eat more healthily?"] },
  { key: "music", label: "Музыка", questions: ["How often do you listen to music?", "What kind of music do you like best?", "When do you usually listen to music?", "Do you prefer listening to music alone or with friends?", "Do you play any musical instrument?", "Why is music important for young people?"] },
  { key: "freetime", label: "Свободное время", questions: ["How much free time do you usually have?", "What do you like doing in your free time?", "Do you prefer spending free time indoors or outdoors?", "Who do you usually spend your free time with?", "Has your favourite hobby changed recently?", "What new hobby would you like to try?"] },
  { key: "travel", label: "Путешествия", questions: ["How often does your family travel?", "What places have you visited recently?", "Do you prefer travelling by train, by car or by plane?", "What do you usually do while travelling?", "Why do many people enjoy travelling?", "Which place would you recommend to a tourist in your country?"] },
  { key: "environment", label: "Экология", questions: ["How often do you think about protecting nature?", "What do you do to help the environment?", "Do you sort your rubbish at home?", "Why is it important to save water and electricity?", "What environmental problem worries you most?", "What advice would you give to people who want to help the planet?"] },
  { key: "school", label: "Школа", questions: ["How do you usually get to school?", "What is your favourite subject?", "How much homework do you get every day?", "Do you take part in any school clubs?", "Why is school education important?", "What would you like to change about your school?"] },
]

// №38 · Монологическое высказывание
const build38 = (it) => ({
  number: 38, generated: true,
  answer: "Монолог 10–12 предложений — оценивается по критериям.",
  condition_text:
    `You are going to give a talk about ${it.topic}. You will have to start in 1.5 minutes and speak for ` +
    `not more than 2 minutes (10–12 sentences). Remember to say:\n` +
    it.points.map((p) => "— " + p + ";").join("\n") + "\nYou have to talk continuously.",
})
const P38 = [
  { key: "travel", label: "Путешествия", topic: "travelling", points: ["why people like travelling", "what means of transport you prefer and why", "what place you would like to visit", "whether travelling is a good way to learn about the world, and why"] },
  { key: "sport", label: "Спорт", topic: "sport", points: ["why sport is important for people", "what sport is popular among teenagers in your country", "what sport you do or would like to do", "whether it is better to do sport or to watch it, and why"] },
  { key: "reading", label: "Чтение", topic: "reading", points: ["why many people enjoy reading", "what kind of books teenagers like", "how often you read and what you read", "whether books are better than films, and why"] },
  { key: "health", label: "Здоровый образ жизни", topic: "a healthy lifestyle", points: ["why a healthy lifestyle is important", "what people do to stay healthy", "what you do to keep fit", "whether it is difficult for teenagers to lead a healthy life, and why"] },
  { key: "music", label: "Музыка", topic: "music", points: ["why people listen to music", "what kinds of music are popular today", "what music you like and when you listen to it", "whether it is important to learn to play an instrument, and why"] },
  { key: "internet", label: "Интернет", topic: "the Internet", points: ["why the Internet is important nowadays", "what people use the Internet for", "how you use the Internet in your daily life", "whether the Internet does more good than harm, and why"] },
  { key: "seasons", label: "Времена года", topic: "seasons", points: ["which season is your favourite and why", "what people usually do in different seasons", "how the weather changes during the year in your region", "whether the weather affects people's mood, and why"] },
  { key: "friendship", label: "Дружба", topic: "friendship", points: ["why friends are important in our life", "what makes a good friend", "how you usually spend time with your friends", "whether it is easy to make new friends, and why"] },
]

// ── Реестр генераторов и мета (темы для UI превью) ───────────────────────────
export const GENERATORS_ENG = {
  20: [fromPool(20, P20_VERBS), fromPool(20, P20_PLURAL), fromPool(20, P20_PRON),
       fromPool(20, P20_ADJ), fromPool(20, P20_ADV), fromPool(20, P20_NUM)],
  21: [fromPool(21, P21_VERBS), fromPool(21, P21_PASSIVE), fromPool(21, P21_MODAL),
       fromPool(21, P21_PLURAL), fromPool(21, P21_PRON), fromPool(21, P21_ADJ),
       fromPool(21, P21_NUM), fromPool(21, P21_COND), fromPool(21, P21_REPORTED), fromPool(21, P21_WISH)],
  22: [fromPool(22, P22_VERBS), fromPool(22, P22_PASSIVE), fromPool(22, P22_MODAL),
       fromPool(22, P22_SEQ), fromPool(22, P22_REPORTED), fromPool(22, P22_COND), fromPool(22, P22_WISH),
       fromPool(22, P22_PLURAL), fromPool(22, P22_PRON), fromPool(22, P22_ADJ)],
  23: [fromPool(23, P23_VERBS), fromPool(23, P23_PASSIVE), fromPool(23, P23_MODAL),
       fromPool(23, P23_SEQ), fromPool(23, P23_COND), fromPool(23, P23_WISH), fromPool(23, P23_PLURAL),
       fromPool(23, P23_PRON), fromPool(23, P23_ADJ), fromPool(23, P23_ADV), fromPool(23, P23_NUM)],
  24: [fromPool(24, P24_VERBS), fromPool(24, P24_PASSIVE), fromPool(24, P24_MODAL),
       fromPool(24, P24_SEQ), fromPool(24, P24_COND), fromPool(24, P24_WISH), fromPool(24, P24_PLURAL),
       fromPool(24, P24_PRON), fromPool(24, P24_ADJ), fromPool(24, P24_NUM)],
  25: [fromPool(25, P25_VERBS), fromPool(25, P25_PASSIVE), fromPool(25, P25_MODAL), fromPool(25, P25_GERUND),
       fromPool(25, P25_SEQ), fromPool(25, P25_REPORTED), fromPool(25, P25_COND), fromPool(25, P25_WISH),
       fromPool(25, P25_PLURAL), fromPool(25, P25_PRON), fromPool(25, P25_ADJ), fromPool(25, P25_ADV), fromPool(25, P25_NUM)],
  26: [fromPool(26, P26_VERBS), fromPool(26, P26_PASSIVE), fromPool(26, P26_MODAL), fromPool(26, P26_FUTURE),
       fromPool(26, P26_REPORTED), fromPool(26, P26_COND), fromPool(26, P26_WISH), fromPool(26, P26_PLURAL),
       fromPool(26, P26_PRON), fromPool(26, P26_ADJ), fromPool(26, P26_ADV), fromPool(26, P26_NUM)],
  27: [fromPool(27, P27_VERBS), fromPool(27, P27_PASSIVE), fromPool(27, P27_SEQ), fromPool(27, P27_REPORTED),
       fromPool(27, P27_COND), fromPool(27, P27_WISH), fromPool(27, P27_PRON), fromPool(27, P27_ADJ), fromPool(27, P27_NUM)],
  28: [fromPool(28, P28_VERBS), fromPool(28, P28_PASSIVE), fromPool(28, P28_MODAL), fromPool(28, P28_REPORTED),
       fromPool(28, P28_COND), fromPool(28, P28_WISH), fromPool(28, P28_PLURAL), fromPool(28, P28_PRON),
       fromPool(28, P28_ADJ), fromPool(28, P28_NUM)],
  29: [fromPool(29, P29_NOUN), fromPool(29, P29_ADJ), fromPool(29, P29_ADV), fromPool(29, P29_NEG)],
  30: [fromPool(30, P30_NOUN), fromPool(30, P30_ADJ), fromPool(30, P30_ADV), fromPool(30, P30_NEG)],
  31: [fromPool(31, P31_NOUN), fromPool(31, P31_ADJ), fromPool(31, P31_ADV), fromPool(31, P31_NEG)],
  32: [fromPool(32, P32_NOUN), fromPool(32, P32_ADJ), fromPool(32, P32_ADV), fromPool(32, P32_NEG)],
  33: [fromPool(33, P33_NOUN), fromPool(33, P33_ADJ), fromPool(33, P33_ADV), fromPool(33, P33_NEG)],
  34: [fromPool(34, P34_NOUN), fromPool(34, P34_ADJ), fromPool(34, P34_ADV), fromPool(34, P34_NEG)],
  35: P35.map((it) => () => build35(it)),
  36: P36.map((it) => () => build36(it)),
  37: P37.map((it) => () => build37(it)),
  38: P38.map((it) => () => build38(it)),
}

export const GEN_META_ENG = {
  20: [
    ["Грамматика (степени, формы)", [
      ["verbs", "Глагол: личная форма", fromPool(20, P20_VERBS)],
      ["plural", "Существительное: мн. число", fromPool(20, P20_PLURAL)],
      ["pron", "Местоимение", fromPool(20, P20_PRON)],
      ["adj", "Прилагательное: степень", fromPool(20, P20_ADJ)],
      ["adv", "Наречие: степень", fromPool(20, P20_ADV)],
      ["num", "Числительное: порядковое", fromPool(20, P20_NUM)],
    ]],
  ],
  21: [
    ["Глагол", [
      ["verbs", "Время/форма глагола", fromPool(21, P21_VERBS)],
      ["passive", "Пассивный залог", fromPool(21, P21_PASSIVE)],
      ["modal", "Модальный (could not)", fromPool(21, P21_MODAL)],
      ["cond", "Условное (will + инф.)", fromPool(21, P21_COND)],
      ["reported", "Косвенная речь (would)", fromPool(21, P21_REPORTED)],
      ["wish", "I wish (past)", fromPool(21, P21_WISH)],
    ]],
    ["Прочее", [
      ["plural", "Существительное: мн. число", fromPool(21, P21_PLURAL)],
      ["pron", "Местоимение", fromPool(21, P21_PRON)],
      ["adj", "Прилагательное: степень", fromPool(21, P21_ADJ)],
      ["num", "Числительное: порядковое", fromPool(21, P21_NUM)],
    ]],
  ],
  22: [
    ["Глагол", [
      ["verbs", "Время/форма глагола", fromPool(22, P22_VERBS)],
      ["passive", "Пассивный залог", fromPool(22, P22_PASSIVE)],
      ["modal", "Модальный (could/could not)", fromPool(22, P22_MODAL)],
      ["seq", "Согласование времён (would)", fromPool(22, P22_SEQ)],
      ["reported", "Косвенная речь (do→did)", fromPool(22, P22_REPORTED)],
      ["cond", "Условное (would + инф.)", fromPool(22, P22_COND)],
      ["wish", "I wish (could/Past)", fromPool(22, P22_WISH)],
    ]],
    ["Прочее", [
      ["plural", "Существительное: мн. число", fromPool(22, P22_PLURAL)],
      ["pron", "Местоимение", fromPool(22, P22_PRON)],
      ["adj", "Прилагательное: степень", fromPool(22, P22_ADJ)],
    ]],
  ],
  23: [
    ["Глагол", [
      ["verbs", "Время/форма глагола", fromPool(23, P23_VERBS)],
      ["passive", "Пассив (прош./наст.)", fromPool(23, P23_PASSIVE)],
      ["modal", "Модальный (could not)", fromPool(23, P23_MODAL)],
      ["seq", "Согласование времён", fromPool(23, P23_SEQ)],
      ["cond", "Условное (will/3sg/are)", fromPool(23, P23_COND)],
      ["wish", "I wish (had/could)", fromPool(23, P23_WISH)],
    ]],
    ["Прочее", [
      ["plural", "Существительное: мн. число", fromPool(23, P23_PLURAL)],
      ["pron", "Местоимение", fromPool(23, P23_PRON)],
      ["adj", "Прилагательное: степень", fromPool(23, P23_ADJ)],
      ["adv", "Наречие: степень", fromPool(23, P23_ADV)],
      ["num", "Числительное: порядковое", fromPool(23, P23_NUM)],
    ]],
  ],
  24: [
    ["Глагол", [
      ["verbs", "Время/форма глагола", fromPool(24, P24_VERBS)],
      ["passive", "Пассивный залог", fromPool(24, P24_PASSIVE)],
      ["modal", "Модальный (could not)", fromPool(24, P24_MODAL)],
      ["seq", "Согласование времён (would)", fromPool(24, P24_SEQ)],
      ["cond", "Условное (if-past / will)", fromPool(24, P24_COND)],
      ["wish", "I wish (could)", fromPool(24, P24_WISH)],
    ]],
    ["Прочее", [
      ["plural", "Существительное: мн. число", fromPool(24, P24_PLURAL)],
      ["pron", "Местоимение (mine/himself)", fromPool(24, P24_PRON)],
      ["adj", "Прилагательное: степень", fromPool(24, P24_ADJ)],
      ["num", "Числительное: порядковое", fromPool(24, P24_NUM)],
    ]],
  ],
  25: [
    ["Глагол", [
      ["verbs", "Время/форма глагола", fromPool(25, P25_VERBS)],
      ["passive", "Пассивный залог", fromPool(25, P25_PASSIVE)],
      ["modal", "Модальный (could not)", fromPool(25, P25_MODAL)],
      ["gerund", "Герундий (V-ing)", fromPool(25, P25_GERUND)],
      ["seq", "Согласование времён", fromPool(25, P25_SEQ)],
      ["reported", "Косвенная речь (was)", fromPool(25, P25_REPORTED)],
      ["cond", "Условное (would go)", fromPool(25, P25_COND)],
      ["wish", "I wish (were/could)", fromPool(25, P25_WISH)],
    ]],
    ["Прочее", [
      ["plural", "Существительное: мн. число", fromPool(25, P25_PLURAL)],
      ["pron", "Местоимение", fromPool(25, P25_PRON)],
      ["adj", "Прилагательное: степень", fromPool(25, P25_ADJ)],
      ["adv", "Наречие: степень", fromPool(25, P25_ADV)],
      ["num", "Числительное: порядковое", fromPool(25, P25_NUM)],
    ]],
  ],
  26: [
    ["Глагол", [
      ["verbs", "Время/форма глагола", fromPool(26, P26_VERBS)],
      ["passive", "Пассивный залог", fromPool(26, P26_PASSIVE)],
      ["modal", "Модальный (needed)", fromPool(26, P26_MODAL)],
      ["future", "Будущее (going to → will)", fromPool(26, P26_FUTURE)],
      ["reported", "Косвенная речь (would)", fromPool(26, P26_REPORTED)],
      ["cond", "Условное (would not be / will)", fromPool(26, P26_COND)],
      ["wish", "I wish (could)", fromPool(26, P26_WISH)],
    ]],
    ["Прочее", [
      ["plural", "Существительное: мн. число", fromPool(26, P26_PLURAL)],
      ["pron", "Местоимение", fromPool(26, P26_PRON)],
      ["adj", "Прилагательное: степень", fromPool(26, P26_ADJ)],
      ["adv", "Наречие: степень", fromPool(26, P26_ADV)],
      ["num", "Числительное: порядковое", fromPool(26, P26_NUM)],
    ]],
  ],
  27: [
    ["Глагол", [
      ["verbs", "Время/форма глагола", fromPool(27, P27_VERBS)],
      ["passive", "Пассивный залог", fromPool(27, P27_PASSIVE)],
      ["seq", "Согласование времён (would go)", fromPool(27, P27_SEQ)],
      ["reported", "Косвенная речь (had to)", fromPool(27, P27_REPORTED)],
      ["cond", "Условное (knew / will)", fromPool(27, P27_COND)],
      ["wish", "I wish (could/knew/had)", fromPool(27, P27_WISH)],
    ]],
    ["Прочее", [
      ["pron", "Местоимение", fromPool(27, P27_PRON)],
      ["adj", "Прилагательное: степень", fromPool(27, P27_ADJ)],
      ["num", "Числительное: порядковое", fromPool(27, P27_NUM)],
    ]],
  ],
  28: [
    ["Глагол", [
      ["verbs", "Время/форма глагола", fromPool(28, P28_VERBS)],
      ["passive", "Пассивный залог", fromPool(28, P28_PASSIVE)],
      ["modal", "Модальный (could not / cannot)", fromPool(28, P28_MODAL)],
      ["reported", "Косвенная речь (liked)", fromPool(28, P28_REPORTED)],
      ["cond", "Условное (were / will ask)", fromPool(28, P28_COND)],
      ["wish", "I wish (could/were/had)", fromPool(28, P28_WISH)],
    ]],
    ["Прочее", [
      ["plural", "Существительное: мн. число", fromPool(28, P28_PLURAL)],
      ["pron", "Местоимение", fromPool(28, P28_PRON)],
      ["adj", "Прилагательное: степень", fromPool(28, P28_ADJ)],
      ["num", "Числительное: порядковое", fromPool(28, P28_NUM)],
    ]],
  ],
  29: [
    ["Словообразование (аффиксы)", [
      ["noun", "Существительное (-tion/-ment/-er/-ist)", fromPool(29, P29_NOUN)],
      ["adj", "Прилагательное (-al/-ous/-ful/-y/-able)", fromPool(29, P29_ADJ)],
      ["adv", "Наречие (-ly)", fromPool(29, P29_ADV)],
      ["neg", "Отрицание (un-/im-)", fromPool(29, P29_NEG)],
    ]],
  ],
  30: [["Словообразование", [
    ["noun", "Существительное", fromPool(30, P30_NOUN)], ["adj", "Прилагательное", fromPool(30, P30_ADJ)],
    ["adv", "Наречие (-ly)", fromPool(30, P30_ADV)], ["neg", "Отрицание (un-/im-/dis-)", fromPool(30, P30_NEG)],
  ]]],
  31: [["Словообразование", [
    ["noun", "Существительное", fromPool(31, P31_NOUN)], ["adj", "Прилагательное", fromPool(31, P31_ADJ)],
    ["adv", "Наречие (-ly)", fromPool(31, P31_ADV)], ["neg", "Отрицание (un-/im-)", fromPool(31, P31_NEG)],
  ]]],
  32: [["Словообразование", [
    ["noun", "Существительное", fromPool(32, P32_NOUN)], ["adj", "Прилагательное", fromPool(32, P32_ADJ)],
    ["adv", "Наречие (-ly)", fromPool(32, P32_ADV)], ["neg", "Отрицание (un-/im-/dis-)", fromPool(32, P32_NEG)],
  ]]],
  33: [["Словообразование", [
    ["noun", "Существительное", fromPool(33, P33_NOUN)], ["adj", "Прилагательное", fromPool(33, P33_ADJ)],
    ["adv", "Наречие (-ly)", fromPool(33, P33_ADV)], ["neg", "Отрицание (dis-/im-/in-)", fromPool(33, P33_NEG)],
  ]]],
  34: [["Словообразование", [
    ["noun", "Существительное", fromPool(34, P34_NOUN)], ["adj", "Прилагательное", fromPool(34, P34_ADJ)],
    ["adv", "Наречие (-ly)", fromPool(34, P34_ADV)], ["neg", "Отрицание (un-/dis-)", fromPool(34, P34_NEG)],
  ]]],
  35: [["Темы письма (№35)", P35.map((it) => [it.key, it.label, () => build35(it)])]],
  36: [["Тексты для чтения вслух (№36)", P36.map((it) => [it.key, it.label, () => build36(it)])]],
  37: [["Темы опроса (№37)", P37.map((it) => [it.key, it.label, () => build37(it)])]],
  38: [["Темы монолога (№38)", P38.map((it) => [it.key, it.label, () => build38(it)])]],
}

// ── Самопроверка: движок должен воспроизводить каждый авторский ответ ─────────
// Ловит опечатки в ответах и в текстах на этапе импорта модуля (dev). При рассогласовании —
// бросает: лучше упасть на превью, чем показать ученику неверную форму.
// эталонные пары «слово+форма → ответ» для регресс-контроля морфологии (особенно удвоений)
const ENGINE_ASSERTIONS = [
  ["chat", "ing", "chatting"], ["stop", "ing", "stopping"], ["run", "ing", "running"],
  ["cover", "past", "covered"], ["open", "past", "opened"], ["travel", "past", "travelled"],
  ["snow", "past", "snowed"], ["play", "past", "played"], ["study", "past", "studied"],
  ["like", "past", "liked"], ["watch", "s", "watches"], ["carry", "s", "carries"],
]
function selfCheck() {
  const asrt = []
  for (const [w, f, exp] of ENGINE_ASSERTIONS) {
    const got = verb(w, f)
    if (got !== exp) asrt.push(`verb(${w},${f})=${got}, ждали ${exp}`)
  }
  for (const [w, exp] of [["big", "bigger"], ["clever", "cleverer"], ["happy", "happiest"], ["nice", "nicest"]]) {
    const got = w === "happy" || w === "nice" ? superlative(w) : comparative(w)
    if (got !== exp) asrt.push(`degree(${w})=${got}, ждали ${exp}`)
  }
  if (asrt.length) throw new Error("taskGeneratorsEng движок:\n" + asrt.join("\n"))
  const pools = {
    P20_VERBS, P20_PLURAL, P20_PRON, P20_ADJ, P20_ADV, P20_NUM,
    P21_VERBS, P21_PASSIVE, P21_MODAL, P21_PLURAL, P21_PRON, P21_ADJ, P21_NUM, P21_COND, P21_REPORTED, P21_WISH,
    P22_VERBS, P22_PASSIVE, P22_MODAL, P22_SEQ, P22_REPORTED, P22_COND, P22_WISH, P22_PLURAL, P22_PRON, P22_ADJ,
    P23_VERBS, P23_PASSIVE, P23_MODAL, P23_SEQ, P23_COND, P23_WISH, P23_PLURAL, P23_PRON, P23_ADJ, P23_ADV, P23_NUM,
    P24_VERBS, P24_PASSIVE, P24_MODAL, P24_SEQ, P24_COND, P24_WISH, P24_PLURAL, P24_PRON, P24_ADJ, P24_NUM,
    P25_VERBS, P25_PASSIVE, P25_MODAL, P25_GERUND, P25_SEQ, P25_REPORTED, P25_COND, P25_WISH, P25_PLURAL, P25_PRON, P25_ADJ, P25_ADV, P25_NUM,
    P26_VERBS, P26_PASSIVE, P26_MODAL, P26_FUTURE, P26_REPORTED, P26_COND, P26_WISH, P26_PLURAL, P26_PRON, P26_ADJ, P26_ADV, P26_NUM,
    P27_VERBS, P27_PASSIVE, P27_SEQ, P27_REPORTED, P27_COND, P27_WISH, P27_PRON, P27_ADJ, P27_NUM,
    P28_VERBS, P28_PASSIVE, P28_MODAL, P28_REPORTED, P28_COND, P28_WISH, P28_PLURAL, P28_PRON, P28_ADJ, P28_NUM,
    P29_NOUN, P29_ADJ, P29_ADV, P29_NEG,
    P30_NOUN, P30_ADJ, P30_ADV, P30_NEG, P31_NOUN, P31_ADJ, P31_ADV, P31_NEG,
    P32_NOUN, P32_ADJ, P32_ADV, P32_NEG, P33_NOUN, P33_ADJ, P33_ADV, P33_NEG,
    P34_NOUN, P34_ADJ, P34_ADV, P34_NEG,
  }
  const errs = []
  for (const [name, pool] of Object.entries(pools)) {
    for (const it of pool) {
      // структурные проверки — для всех элементов (в т.ч. skipCheck: словообразование)
      if (!it.text.includes("@")) errs.push(`${name}/${it.word}: нет плейсхолдера @`)
      if (it.skipCheck && !it.answer) errs.push(`${name}/${it.word}: skipCheck без answer`)
      if (it.skipCheck) continue
      // движок — источник истины для форм (не для словообразования)
      let got
      try { got = transform(it.word, it.spec) } catch (e) { errs.push(`${name}/${it.word}: ${e.message}`); continue }
      if (it.answer && it.answer !== got) errs.push(`${name}/${it.word}: движок=${got}, задано=${it.answer}`)
    }
  }
  if (errs.length) throw new Error("taskGeneratorsEng selfCheck:\n" + errs.join("\n"))
}
selfCheck()
