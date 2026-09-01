import React from "react"
import { createRoot } from "react-dom/client"
import "/src/index.css"
import Results from "/src/pages/Results.jsx"
const students = [{ id: 1, name: "Иван Петров", goal: "ОГЭ", targetScore: 26, studentAccountId: "acc-1" }]
createRoot(document.getElementById("root")).render(
  <React.StrictMode><Results students={students} loaded user={{ id: "t1" }} /></React.StrictMode>,
)
