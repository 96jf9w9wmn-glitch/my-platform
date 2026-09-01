import React from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import Chat from "./pages/Chat"

const contacts = [
  { id: "s:1", name: "Кирилл", role: "Ученик" },
  { id: "s:2", name: "Михаил(Shougaze)", role: "Ученик" },
  { id: "s:3", name: "Михаил Журавлёв", role: "Ученик" },
  { id: "s:4", name: "Иван Балакин", role: "Ученик" },
  { id: "s:5", name: "Аветисян Овсеп", role: "Ученик" },
  { id: "s:6", name: "ццмии", role: "Ученик" },
]
createRoot(document.getElementById("root")).render(
  <div className="flex flex-col h-full w-full">
    <Chat myId="t:lab" myName="Лаб" initialContacts={contacts} />
  </div>
)
