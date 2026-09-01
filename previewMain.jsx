import { useState } from "react"
import { createRoot } from "react-dom/client"
import "./src/index.css"
import { StudentFilter } from "./src/pages/Variants"

const OPTIONS = [
  { id: "all", name: "Все ученики" },
  { id: "1", name: "Анна Кузнецова", count: 5 },
  { id: "2", name: "Борис Ветров", count: 2 },
  { id: "3", name: "Виктория Соловьёва-Ким", count: 11 },
  { id: "4", name: "Гриша Пан", count: 1 },
  { id: "5", name: "Дмитрий Орлов", count: 3 },
]

function Demo() {
  const [who, setWho] = useState("all")
  return (
    <div style={{ padding: 40, minHeight: "100vh" }}>
      <StudentFilter options={OPTIONS} value={who} onChange={setWho} />
      <div style={{ marginTop: 400 }}>выбран: {who}</div>
    </div>
  )
}
createRoot(document.getElementById("root")).render(<Demo />)
