// Временная страница для проверки доски без входа в кабинет. Удаляется после проверки.
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import Board from "./components/Board"

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Board roomId="dev-board" userId="dev-user" userName="Проверка" theme="light" onClose={() => {}} />
  </StrictMode>,
)
