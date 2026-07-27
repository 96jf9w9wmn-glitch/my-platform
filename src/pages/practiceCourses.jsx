// Курсы интерактивной практики (движок — Practice.jsx, чертежи — practiceVisuals.jsx).
//
// Формат шага (step.kind):
//   info    — экран-объяснение, кнопка «Понятно»
//   choice  — один правильный вариант
//   multi   — несколько правильных вариантов
//   number  — числовой ответ (tol — допуск, по умолчанию точное совпадение)
//   explore — МАНИПУЛЯТИВ: ползунки меняют картинку в реальном времени,
//             цель считается достигнутой, когда check(vals) === true
//   order   — расставить карточки в правильном порядке (тапами, без drag)
//   hotspot — тапнуть по нужной части чертежа
//
// Текст условий проходит через renderTaskMath, поэтому в нём можно писать
// токены ⟦f:n:d⟧ (дробь столбиком) и ⟦r:x⟧ (корень) — как в банке заданий.

import { fmtNum as fmt } from "../utils"
import {
  LinearVisual, PythVisual, TriangleHotspot, BallsVisual, PriceVisual, NumberLineVisual,
} from "./practiceVisuals.jsx"

// ── курсы ───────────────────────────────────────────────────────────────

export const COURSES = [
  {
    id: "linear",
    title: "Линейная функция",
    subtitle: "Как k и b управляют прямой",
    icon: "trending-up",
    tint: "#007AFF",
    lessons: [
      {
        id: "linear-1",
        title: "Наклон k",
        blurb: "Что делает коэффициент перед x",
        steps: [
          {
            kind: "info",
            title: "y = kx + b",
            body: "Любая линейная функция — это прямая. Число k отвечает за наклон, а b — за то, где прямая пересекает ось y. Сейчас потрогаем оба своими руками.",
            visual: (ctx) => <LinearVisual vals={{ k: 1, b: 2 }} {...ctx} />,
          },
          {
            kind: "explore",
            prompt: "Двигай ползунок и следи за прямой.",
            goalText: "Сделай так, чтобы функция убывала",
            controls: [{ key: "k", label: "k", min: -3, max: 3, step: 0.5, def: 1 }],
            visual: (ctx) => <LinearVisual vals={{ ...ctx.vals, b: 0 }} />,
            readout: (v) => `k = ${fmt(v.k)} · функция ${v.k > 0 ? "возрастает" : v.k < 0 ? "убывает" : "постоянна"}`,
            check: (v) => v.k < 0,
            explain: "Прямая идёт вниз ровно тогда, когда k < 0. При k > 0 она поднимается, при k = 0 — горизонтальна.",
          },
          {
            kind: "choice",
            prompt: "На рисунке прямая опускается слева направо и пересекает ось y выше нуля. Что верно?",
            visual: () => <LinearVisual vals={{ k: -0.8, b: 2 }} />,
            options: [
              { id: "a", label: "k > 0 и b > 0" },
              { id: "b", label: "k < 0 и b > 0" },
              { id: "c", label: "k < 0 и b < 0" },
              { id: "d", label: "k = 0 и b > 0" },
            ],
            correct: "b",
            explain: "Прямая убывает → k < 0. Ось y она пересекает выше нуля → b > 0.",
          },
          {
            kind: "explore",
            prompt: "Теперь два ползунка: наклон и сдвиг.",
            goalText: "Проведи прямую через точку (0; 3)",
            controls: [
              { key: "k", label: "k", min: -3, max: 3, step: 0.5, def: 1 },
              { key: "b", label: "b", min: -5, max: 5, step: 1, def: 0 },
            ],
            visual: (ctx) => <LinearVisual vals={ctx.vals} mark={[0, 3]} />,
            readout: (v) => `y = ${fmt(v.k)}x ${v.b < 0 ? "−" : "+"} ${fmt(Math.abs(v.b))}`,
            check: (v) => v.b === 3,
            explain: "Через точку (0; 3) проходит любая прямая с b = 3 — наклон k при этом может быть любым. Значит, b — это в точности ордината пересечения с осью y.",
          },
          {
            kind: "number",
            prompt: "Прямая y = kx + 1 проходит через точку (2; 7). Найдите k.",
            correct: 3,
            explain: "Подставляем: 7 = k · 2 + 1, значит 2k = 6 и k = 3.",
          },
          {
            kind: "choice",
            prompt: "Функция y = −2x + 5. В какой точке график пересекает ось y?",
            options: [
              { id: "a", label: "(0; 5)" },
              { id: "b", label: "(5; 0)" },
              { id: "c", label: "(0; −2)" },
              { id: "d", label: "(2,5; 0)" },
            ],
            correct: "a",
            explain: "На оси y всегда x = 0, тогда y = −2 · 0 + 5 = 5.",
          },
        ],
      },
      {
        id: "linear-2",
        title: "Нули и параллельность",
        blurb: "Где прямая пересекает ось x",
        steps: [
          {
            kind: "explore",
            prompt: "Нуль функции — это точка, где прямая пересекает ось x.",
            goalText: "Пусть прямая пересечёт ось x в точке x = 2",
            controls: [
              { key: "k", label: "k", min: -3, max: 3, step: 0.5, def: 1 },
              { key: "b", label: "b", min: -5, max: 5, step: 1, def: 3 },
            ],
            visual: (ctx) => <LinearVisual vals={ctx.vals} mark={[2, 0]} />,
            readout: (v) => (v.k === 0 ? "k = 0 — прямая горизонтальна" : `нуль функции: x = ${fmt(-v.b / v.k)}`),
            check: (v) => v.k !== 0 && Math.abs(-v.b / v.k - 2) < 1e-9,
            explain: "Нуль ищем из уравнения kx + b = 0, откуда x = −b/k. Подходит любая пара, где −b/k = 2, например k = 1, b = −2.",
          },
          {
            kind: "number",
            prompt: "Найдите нуль функции y = 3x − 12.",
            correct: 4,
            explain: "3x − 12 = 0 → 3x = 12 → x = 4.",
          },
          {
            kind: "choice",
            prompt: "Как расположены прямые y = 2x + 1 и y = 2x − 3?",
            options: [
              { id: "a", label: "Параллельны" },
              { id: "b", label: "Пересекаются в одной точке" },
              { id: "c", label: "Совпадают" },
              { id: "d", label: "Перпендикулярны" },
            ],
            correct: "a",
            explain: "Наклон одинаковый (k = 2), а сдвиг разный — значит, прямые параллельны и никогда не пересекутся.",
          },
          {
            kind: "number",
            prompt: "Прямая y = −x + b проходит через точку (3; 1). Найдите b.",
            correct: 4,
            explain: "1 = −3 + b, значит b = 4.",
          },
          {
            kind: "multi",
            prompt: "Выберите ВСЕ функции, графики которых параллельны прямой y = 0,5x + 7.",
            options: [
              { id: "a", label: "y = 0,5x − 2" },
              { id: "b", label: "y = 2x + 7" },
              { id: "c", label: "y = ⟦f:1:2⟧x + 100" },
              { id: "d", label: "y = −0,5x + 7" },
            ],
            correct: ["a", "c"],
            explain: "Параллельность — это равные k. У прямой k = 0,5, столько же у вариантов «0,5x − 2» и «½x + 100».",
          },
        ],
      },
    ],
  },

  {
    id: "pyth",
    title: "Теорема Пифагора",
    subtitle: "Катеты, гипотенуза и квадраты",
    icon: "ruler",
    tint: "#ff9f0a",
    lessons: [
      {
        id: "pyth-1",
        title: "Стороны и квадраты",
        blurb: "Собери прямоугольный треугольник руками",
        steps: [
          {
            kind: "info",
            title: "Кто есть кто",
            body: "В прямоугольном треугольнике две стороны, образующие прямой угол, — катеты. Третья, самая длинная, лежит напротив прямого угла — это гипотенуза.",
            visual: () => <TriangleHotspot selected={null} />,
          },
          {
            kind: "hotspot",
            prompt: "Нажмите на гипотенузу треугольника.",
            visual: (ctx) => <TriangleHotspot selected={ctx.selected} />,
            zones: [
              { id: "cat-a", label: "катет AC" },
              { id: "cat-b", label: "катет CB" },
              { id: "hyp", label: "гипотенуза AB" },
            ],
            correct: "hyp",
            explain: "Гипотенуза — сторона напротив прямого угла. Прямой угол здесь при вершине C, значит гипотенуза — AB.",
          },
          {
            kind: "explore",
            prompt: "Зелёный и синий квадраты построены на катетах. Их суммарная площадь — это c².",
            goalText: "Подберите катеты так, чтобы гипотенуза стала ровно 5",
            controls: [
              { key: "a", label: "катет a", min: 1, max: 8, step: 1, def: 2 },
              { key: "b", label: "катет b", min: 1, max: 8, step: 1, def: 2 },
            ],
            visual: (ctx) => <PythVisual vals={ctx.vals} />,
            readout: (v) => `c = ⟦r:${v.a * v.a + v.b * v.b}⟧ = ${fmt(Math.sqrt(v.a * v.a + v.b * v.b))}`,
            check: (v) => v.a * v.a + v.b * v.b === 25,
            explain: "Нужно a² + b² = 25. Подходят катеты 3 и 4 — знаменитый «египетский» треугольник 3, 4, 5.",
          },
          {
            kind: "number",
            prompt: "Катеты прямоугольного треугольника равны 6 и 8. Найдите гипотенузу.",
            correct: 10,
            explain: "c² = 6² + 8² = 36 + 64 = 100, значит c = 10.",
          },
          {
            kind: "number",
            prompt: "Гипотенуза равна 13, один катет равен 5. Найдите второй катет.",
            correct: 12,
            explain: "b² = 13² − 5² = 169 − 25 = 144, значит b = 12.",
          },
          {
            kind: "choice",
            prompt: "Какой треугольник со сторонами 5, 12 и 13?",
            options: [
              { id: "a", label: "Прямоугольный" },
              { id: "b", label: "Остроугольный" },
              { id: "c", label: "Тупоугольный" },
              { id: "d", label: "Такого не существует" },
            ],
            correct: "a",
            explain: "5² + 12² = 25 + 144 = 169 = 13². Обратная теорема Пифагора: треугольник прямоугольный.",
          },
        ],
      },
    ],
  },

  {
    id: "prob",
    title: "Вероятность",
    subtitle: "Считаем шансы на пальцах",
    icon: "target",
    tint: "#30d158",
    lessons: [
      {
        id: "prob-1",
        title: "Классическая вероятность",
        blurb: "Мешок с шарами, которым можно управлять",
        steps: [
          {
            kind: "info",
            title: "Формула одна",
            body: "Вероятность = (сколько исходов нам подходит) ÷ (сколько исходов всего). Число всегда получается от 0 до 1.",
            visual: () => <BallsVisual vals={{ blue: 2, red: 6 }} />,
          },
          {
            kind: "explore",
            prompt: "Меняйте состав мешка и следите за вероятностью.",
            goalText: "Сделайте вероятность вытащить синий шар равной 0,25",
            controls: [
              { key: "blue", label: "синих", min: 0, max: 8, step: 1, def: 3 },
              { key: "red", label: "красных", min: 0, max: 8, step: 1, def: 3 },
            ],
            visual: (ctx) => <BallsVisual vals={ctx.vals} />,
            readout: (v) => (v.blue + v.red === 0 ? "мешок пуст" : `P = ${v.blue}/${v.blue + v.red} = ${fmt(v.blue / (v.blue + v.red))}`),
            check: (v) => v.blue + v.red > 0 && Math.abs(v.blue / (v.blue + v.red) - 0.25) < 1e-9,
            explain: "Нужно, чтобы синие составляли четверть мешка: 1 из 4, 2 из 8 и так далее.",
          },
          {
            kind: "number",
            prompt: "В ящике 5 белых и 15 чёрных шаров. Найдите вероятность вытащить белый.",
            correct: 0.25,
            tol: 0.001,
            explain: "Всего 5 + 15 = 20 шаров, подходящих 5. P = 5/20 = 0,25.",
          },
          {
            kind: "choice",
            prompt: "Вероятность события A равна 0,3. Чему равна вероятность того, что A НЕ произойдёт?",
            options: [
              { id: "a", label: "0,3" },
              { id: "b", label: "0,7" },
              { id: "c", label: "1,3" },
              { id: "d", label: "0,03" },
            ],
            correct: "b",
            explain: "Событие или произойдёт, или нет: сумма вероятностей равна 1. Значит 1 − 0,3 = 0,7.",
          },
          {
            kind: "number",
            prompt: "Бросают игральный кубик. Найдите вероятность того, что выпадет чётное число очков.",
            correct: 0.5,
            tol: 0.001,
            explain: "Чётных граней три (2, 4, 6) из шести. P = 3/6 = 0,5.",
          },
          {
            kind: "multi",
            prompt: "Какие числа МОГУТ быть вероятностью события?",
            options: [
              { id: "a", label: "0" },
              { id: "b", label: "0,64" },
              { id: "c", label: "1,2" },
              { id: "d", label: "−0,1" },
              { id: "e", label: "1" },
            ],
            correct: ["a", "b", "e"],
            explain: "Вероятность не бывает меньше 0 и больше 1. Значения 0 (невозможное событие) и 1 (достоверное) допустимы.",
          },
        ],
      },
    ],
  },

  {
    id: "percent",
    title: "Проценты",
    subtitle: "Скидки, наценки и обратный ход",
    icon: "dollar",
    tint: "#bf5af2",
    lessons: [
      {
        id: "percent-1",
        title: "Скидка и наценка",
        blurb: "Живой ценник под вашим ползунком",
        steps: [
          {
            kind: "explore",
            prompt: "Товар стоит 4000 ₽. Двигайте скидку и смотрите на цену.",
            goalText: "Добейтесь итоговой цены 2600 ₽",
            controls: [{ key: "d", label: "скидка, %", min: 0, max: 90, step: 5, def: 0 }],
            visual: (ctx) => <PriceVisual vals={ctx.vals} />,
            readout: (v) => `4000 · (100 − ${v.d}) / 100 = ${Math.round(4000 * (100 - v.d) / 100)} ₽`,
            check: (v) => Math.round(4000 * (100 - v.d) / 100) === 2600,
            explain: "2600 / 4000 = 0,65 — осталось 65% цены, значит скидка 35%.",
          },
          {
            kind: "number",
            prompt: "Товар стоил 800 рублей и подорожал на 15%. Сколько он стоит теперь? Ответ дайте в рублях.",
            correct: 920,
            explain: "800 · 1,15 = 920 рублей.",
          },
          {
            kind: "choice",
            prompt: "Цену подняли на 10%, а потом опустили на 10%. Что стало с ценой?",
            options: [
              { id: "a", label: "Вернулась к исходной" },
              { id: "b", label: "Стала меньше исходной" },
              { id: "c", label: "Стала больше исходной" },
              { id: "d", label: "Зависит от исходной цены" },
            ],
            correct: "b",
            explain: "1,1 · 0,9 = 0,99 — осталось 99% исходной цены. Второй процент считается уже от большей суммы, поэтому «минус» перевешивает.",
          },
          {
            kind: "number",
            prompt: "После скидки 20% товар стоит 1200 рублей. Сколько он стоил до скидки?",
            correct: 1500,
            explain: "1200 — это 80% исходной цены. Значит цена была 1200 / 0,8 = 1500 рублей.",
          },
        ],
      },
    ],
  },

  {
    id: "compare",
    title: "Сравнение чисел",
    subtitle: "Дроби и корни на одной прямой",
    icon: "bar-chart",
    tint: "#5856d6",
    lessons: [
      {
        id: "compare-1",
        title: "Что больше",
        blurb: "Расставляем числа по местам",
        steps: [
          {
            kind: "info",
            title: "Общий приём",
            body: "Чтобы сравнить дроби и десятичные, приведите их к одному виду — проще всего к десятичному. Дальше числа просто выстраиваются на числовой прямой.",
            visual: () => <NumberLineVisual marks={[{ v: 1 / 3, label: "⅓" }, { v: 0.5, label: "0,5" }]} />,
          },
          {
            kind: "order",
            prompt: "Расставьте числа в порядке ВОЗРАСТАНИЯ.",
            items: [
              { id: "a", label: "0,5", v: 0.5 },
              { id: "b", label: "⟦f:1:3⟧", v: 1 / 3 },
              { id: "c", label: "0,45", v: 0.45 },
              { id: "d", label: "⟦f:2:5⟧", v: 0.4 },
            ],
            correct: ["b", "d", "c", "a"],
            explain: "Переводим в десятичные: ⅓ ≈ 0,333; ⅖ = 0,4; затем 0,45 и 0,5.",
          },
          {
            kind: "order",
            prompt: "Расставьте числа в порядке ВОЗРАСТАНИЯ.",
            items: [
              { id: "a", label: "⟦r:2⟧", v: Math.SQRT2 },
              { id: "b", label: "1,5", v: 1.5 },
              { id: "c", label: "⟦r:3⟧", v: Math.sqrt(3) },
              { id: "d", label: "1,2", v: 1.2 },
            ],
            correct: ["d", "a", "b", "c"],
            explain: "√2 ≈ 1,41 и √3 ≈ 1,73. Получаем 1,2 < √2 < 1,5 < √3.",
          },
          {
            kind: "choice",
            prompt: "Какое из чисел наибольшее?",
            options: [
              { id: "a", label: "⟦f:7:8⟧" },
              { id: "b", label: "0,87" },
              { id: "c", label: "⟦f:8:9⟧" },
              { id: "d", label: "0,8" },
            ],
            correct: "c",
            explain: "⁷⁄₈ = 0,875, ⁸⁄₉ ≈ 0,889. Наибольшее — ⁸⁄₉.",
          },
          {
            kind: "number",
            prompt: "Между какими соседними целыми числами лежит ⟦r:57⟧? В ответ запишите меньшее из них.",
            correct: 7,
            explain: "7² = 49, 8² = 64, а 49 < 57 < 64. Значит 7 < √57 < 8.",
          },
        ],
      },
    ],
  },
]

export const ALL_LESSONS = COURSES.flatMap((c) => c.lessons.map((l) => ({ ...l, courseId: c.id, tint: c.tint })))
