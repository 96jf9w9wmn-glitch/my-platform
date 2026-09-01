import { useState } from "react"
import { createRoot } from "react-dom/client"
import "./src/index.css"
import { StudentFilter } from "./src/pages/Variants"
import SegmentSwitch from "./src/components/SegmentSwitch"

const OPTIONS = [
  { id: "all", name: "Все ученики" },
  { id: "1", name: "Михаил(Shougaze)", count: 5 },
  { id: "2", name: "Борис Ветров", count: 2 },
]
const GROUPS = [{ key: "all", label: "Все" }, { key: "ОГЭ", label: "ОГЭ" }, { key: "ЕГЭ", label: "ЕГЭ" }]

function Demo() {
  const [who, setWho] = useState("1")
  const [g, setG] = useState("all")
  return (
    <div style={{ padding: 40, minHeight: "100vh" }}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
        <SegmentSwitch size="sm" equal={false} items={GROUPS} value={g} onChange={setG} className="self-start flex-shrink-0" />
        <StudentFilter options={OPTIONS} value={who} onChange={setWho} />
      </div>
      <div id="dims" style={{ marginTop: 300, fontSize: 12 }} />
    </div>
  )
}
createRoot(document.getElementById("root")).render(<Demo />)
