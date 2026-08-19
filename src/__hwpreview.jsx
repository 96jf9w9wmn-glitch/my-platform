import { createRoot } from "react-dom/client"
import "./index.css"
import { HomeworkCard } from "./pages/Homework"

const tasks = [
  "Найдите наибольший корень уравнения x^3 - 3x^2 - x + 3 = 0.",
  "Найдите средний по величине корень уравнения x^3 + 2x^2 - 9x - 18 = 0.",
  "Найдите сумму корней уравнения x^3 - 4x^2 - 4x + 16 = 0.",
  "Найдите произведение корней уравнения 2x^3 - 6x^2 - 8x + 24 = 0.",
  "Найдите сумму корней уравнения x^3 + 5x^2 - 4x - 20 = 0.",
  "Найдите наименьший корень уравнения x^3 - 2x^2 - 9x + 18 = 0.",
  "Найдите корень, не являющийся кратным, уравнения 3x^3 + 6x^2 - 12x - 24 = 0.",
  "Найдите сумму квадратов корней уравнения x^3 - 7x^2 - x + 7 = 0.",
]
const mcq = {
  id: 1, title: "Кубические уравнения (метод группировки)", hw_type: "test", status: "done",
  grade: 5, question_count: tasks.length, test_score: 7,
  description: "Решите кубическое уравнение методом группировки. Выберите правильный корень или сумму корней (если указано).\n\n"
    + tasks.map((t, i) => `${i + 1}. ${t}`).join("\n"),
  test_options: tasks.map((_, i) => ["-1", "3", `${i + 2}`, "0"]),
  correct_answers: tasks.map(() => "3"),
  deadline: "2026-08-25",
}
const written = {
  id: 2, title: "Дроби и корни", hw_type: "written", status: "assigned",
  description: "Реши в тетради, фото пришли до пятницы.\n\n1. Упростите \\frac{x^2-9}{x+3}.\n2. Вычислите \\sqrt{144} + 2^5.",
  correct_answers: ["x-3", "44"],
}
const plain = { id: 3, title: "Без нумерации", hw_type: "written", status: "assigned", description: "Прочитать параграф 12 и выписать определения." }

function Demo() {
  return (
    <div className="p-6 flex flex-col gap-3 max-w-3xl mx-auto">
      <button className="text-xs text-blue-600 self-start"
        onClick={() => document.documentElement.classList.toggle("dark")}>тема</button>
      <HomeworkCard hw={mcq} studentName="Артик" onUpdate={() => {}} onEdit={() => {}} />
      <HomeworkCard hw={written} studentName="Артик" onUpdate={() => {}} onEdit={() => {}} />
      <HomeworkCard hw={plain} studentName="Артик" onUpdate={() => {}} onEdit={() => {}} />
    </div>
  )
}
createRoot(document.getElementById("root")).render(<Demo />)
