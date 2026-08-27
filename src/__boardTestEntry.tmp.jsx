import React from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import Board from "./components/Board.jsx"
const q = new URLSearchParams(location.search)
createRoot(document.getElementById("root")).render(
  <Board roomId={`__test_${q.get("room") || "ui"}`} userId="tester-ui" userName="Тестер" onClose={() => {}} canAddTasks={true} />
)
