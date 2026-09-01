import { createRoot } from "react-dom/client"
import Board from "./components/Board"
import "./index.css"
createRoot(document.getElementById("root")).render(
  <Board roomId="dev-room" userId="t:dev" userName="Dev" theme="light" onClose={() => console.log("close")} canAddTasks />
)
