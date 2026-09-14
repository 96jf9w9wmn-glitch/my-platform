// Стенд окна группы: проверяем диалог роспуска и то, какой выбор уезжает наверх.
import { createRoot } from "react-dom/client"
import { useState } from "react"
import GroupModal from "./components/GroupModal"
import "./index.css"

const students = [
  { id: 1, name: "Артик Петров", lessons: [
    { date: "2026-09-01", time: "09:00", groupId: "g1", groupName: "дети", duration: 60 },
    { date: "2026-09-20", time: "09:00", groupId: "g1", groupName: "дети", duration: 60 },
  ] },
  { id: 2, name: "Вика Смирнова", lessons: [
    { date: "2026-09-20", time: "09:00", groupId: "g1", groupName: "дети", duration: 60 },
  ] },
]
const group = { id: "g1", name: "дети", memberIds: ["1", "2"], lessonPrice: 800, lessonDuration: 60 }

function Stand() {
  const [log, setLog] = useState([])
  return (
    <>
      <pre id="log" style={{ position: "fixed", left: 8, top: 8, zIndex: 99, fontSize: 12 }}>{log.join("\n")}</pre>
      <GroupModal group={group} students={students}
        onSave={async (g) => ({ group: g })}
        onDelete={async (id, opts) => { setLog((p) => [...p, `delete ${id} ${JSON.stringify(opts)}`]); return {} }}
        onClose={() => setLog((p) => [...p, "closed"])} />
    </>
  )
}
createRoot(document.getElementById("root")).render(<Stand />)
