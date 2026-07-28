import { useEffect, useRef, useState, useCallback } from "react"
import { supabase } from "../supabase"
import Icon from "./Icon"
import { renderScene, preloadSceneImages, isDarkColor } from "./boardPaint"

// История досок по ученику: что разбирали на прошлых занятиях. Живая доска одна
// (таблица boards), а сюда при закрытии откладывается снимок сцены за день —
// см. supabase/board_snapshots.sql. Открывается только на чтение: прошлый урок
// правится не карандашом, а новым занятием.
//
// Репетитор читает таблицу напрямую (RLS пускает по tutor_id), ученик — через
// RPC с session_token: аккаунты учеников не заведены в auth.users.

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"]

function humanDate(iso) {
  const [y, m, d] = String(iso).split("-").map(Number)
  if (!y || !m || !d) return String(iso)
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  if (iso === today) return "Сегодня"
  const suffix = y === now.getFullYear() ? "" : ` ${y}`
  return `${d} ${MONTHS[m - 1]}${suffix}`
}

// Просмотр снимка: сцена вписана в окно, зум — кнопками (холст едет в скролле).
export function BoardSnapshotView({ scene, date, studentName, onClose }) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const imagesRef = useRef(new Map())
  const [zoom, setZoom] = useState(1)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    preloadSceneImages(scene?.strokes || []).then((cache) => {
      if (!alive) return
      imagesRef.current = cache
      setReady(true)
    })
    return () => { alive = false }
  }, [scene])

  const draw = useCallback(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current
    if (!wrap || !canvas) return
    const w = wrap.clientWidth * zoom, h = wrap.clientHeight * zoom
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    renderScene(canvas, scene, { width: w, height: h, padding: 24, images: imagesRef.current, dpr: window.devicePixelRatio || 1 })
  }, [scene, zoom])

  useEffect(() => { draw() }, [draw, ready])
  useEffect(() => {
    const ro = new ResizeObserver(() => draw())
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [draw])
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  function download() {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      const a = document.createElement("a")
      a.href = canvas.toDataURL("image/png")
      a.download = `Доска · ${studentName || ""} · ${date}.png`.replace(/\s+/g, " ")
      a.click()
    } catch { /* холст с чужой картинкой без CORS — скачать нельзя, просто ничего не делаем */ }
  }

  // Шапка подстраивается под цвет ФОНА ДОСКИ, а не под тему приложения: снимок
  // тёмной доски в светлой теме иначе получил бы белую панель поверх чёрного холста.
  const bg = scene?.bgColor || "#ffffff"
  const darkBg = isDarkColor(bg)
  const ink = darkBg ? "#e5e5ea" : "#374151"
  const btn = `press-tap p-1.5 rounded-lg ${darkBg ? "hover:bg-white/10" : "hover:bg-black/5"}`
  return (
    <div className="fixed inset-0 z-[100001] flex flex-col" style={{ background: bg }}>
      <div className="flex items-center justify-between px-3 h-12 border-b flex-shrink-0"
        style={{ borderColor: darkBg ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)" }}>
        <div className="flex items-center gap-2 text-sm font-medium min-w-0" style={{ color: ink }}>
          <Icon name="clipboard" size={16} />
          <span className="truncate">Доска · {humanDate(date)}</span>
          <span className="text-xs text-gray-400 hidden sm:inline">только чтение</span>
        </div>
        <div className="flex items-center gap-1" style={{ color: ink }}>
          <button onClick={() => setZoom((z) => Math.max(1, z - 0.5))} title="Меньше"
            className={`${btn} disabled:opacity-30`} disabled={zoom <= 1}>
            <Icon name="minus" size={16} />
          </button>
          <span className="text-xs text-gray-400 w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(4, z + 0.5))} title="Больше"
            className={`${btn} disabled:opacity-30`} disabled={zoom >= 4}>
            <Icon name="plus" size={16} />
          </button>
          <button onClick={download} title="Скачать PNG" className={btn}>
            <Icon name="download" size={16} />
          </button>
          <button onClick={onClose} title="Закрыть" className={btn}>
            <Icon name="x" size={18} />
          </button>
        </div>
      </div>
      <div ref={wrapRef} className="flex-1 min-h-0 overflow-auto">
        <canvas ref={canvasRef} style={{ display: "block" }} />
      </div>
    </div>
  )
}

function BoardHistory({ studentId, studentName, account = null, token = null }) {
  const [rows, setRows] = useState([])
  const [open, setOpen] = useState(null)     // { date, scene }
  const [loadingDate, setLoadingDate] = useState(null)

  useEffect(() => {
    if (!studentId) return
    let alive = true
    const query = account && token
      ? supabase.rpc("board_snapshot_list", { p_account: account, p_token: token, p_student_id: String(studentId) })
      : supabase.from("board_snapshots")
        .select("lesson_date, preview, strokes")
        .eq("student_id", String(studentId))
        .order("lesson_date", { ascending: false })
        .limit(24)
    // Таблицы может не быть (миграция board_snapshots.sql не выполнена) — тогда блока просто нет.
    query.then(({ data }) => { if (alive && data) setRows(data) })
    return () => { alive = false }
  }, [studentId, account, token])

  async function openDate(date) {
    setLoadingDate(date)
    try {
      let scene = null
      if (account && token) {
        const { data } = await supabase.rpc("board_snapshot_get", {
          p_account: account, p_token: token, p_student_id: String(studentId), p_date: date,
        })
        scene = data
      } else {
        const { data } = await supabase.from("board_snapshots")
          .select("scene").eq("student_id", String(studentId)).eq("lesson_date", date).maybeSingle()
        scene = data?.scene
      }
      if (scene) setOpen({ date, scene })
    } finally {
      setLoadingDate(null)
    }
  }

  if (!rows.length) return null

  return (
    <div className="glass p-4">
      <h2 className="text-sm font-medium mb-3">Доски занятий</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {rows.map((r) => (
          <button key={r.lesson_date} onClick={() => openDate(r.lesson_date)}
            className="press-fill glass-sm rounded-2xl overflow-hidden text-left">
            <div className="aspect-[16/10] bg-white dark:bg-white/5 flex items-center justify-center overflow-hidden">
              {r.preview
                ? <img src={r.preview} alt="" className="w-full h-full object-cover" />
                : <Icon name="clipboard" size={20} className="text-gray-300" />}
            </div>
            <div className="px-2.5 py-2 flex items-center justify-between gap-2">
              <span className="text-xs font-medium truncate">{humanDate(r.lesson_date)}</span>
              {loadingDate === r.lesson_date
                ? <span className="loader-ring" style={{ width: 12, height: 12 }} />
                : <span className="text-[11px] text-gray-400 tabular-nums">{r.strokes}</span>}
            </div>
          </button>
        ))}
      </div>
      {open && (
        <BoardSnapshotView scene={open.scene} date={open.date} studentName={studentName} onClose={() => setOpen(null)} />
      )}
    </div>
  )
}

export default BoardHistory
