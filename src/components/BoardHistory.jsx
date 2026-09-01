import { useEffect, useRef, useState, useCallback } from "react"
import { supabase } from "../supabase"
import { signBoardScene } from "../storageUrl"
import Icon from "./Icon"
import ConfirmModal from "./ConfirmModal"
import { useClosing, CLOSE_MS } from "../useClosing"
import { renderScene, preloadSceneImages, isDarkColor } from "./boardPaint"

// Полноэкранный слой уходит той же «походкой», что и всё остальное
// (CLOSE_MS ↔ --leave-ms) — в паре с .screen-fade.is-closing в index.css
const SCREEN_CLOSE_MS = CLOSE_MS

// История досок по ученику: что разбирали на прошлых занятиях. Живая доска одна
// (таблица boards), а сюда при закрытии откладывается снимок сцены за день —
// см. supabase/board_snapshots.sql. Открывается только на чтение: прошлый урок
// правится не карандашом, а новым занятием.
//
// Репетитор читает таблицу напрямую (RLS пускает по tutor_id), ученик — через
// RPC с session_token: аккаунты учеников не заведены в auth.users.

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"]

function todayIso() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

function humanDate(iso) {
  const [y, m, d] = String(iso).split("-").map(Number)
  if (!y || !m || !d) return String(iso)
  const now = new Date()
  if (iso === todayIso()) return "Сегодня"
  const suffix = y === now.getFullYear() ? "" : ` ${y}`
  return `${d} ${MONTHS[m - 1]}${suffix}`
}

// Просмотр снимка: сцена вписана в окно, зум — кнопками (холст едет в скролле).
export function BoardSnapshotView({ scene, date, studentName, onClose, onOpenBoard = null }) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const imagesRef = useRef(new Map())
  const [zoom, setZoom] = useState(1)
  const [ready, setReady] = useState(false)
  // Снимок открывается поверх всего экрана — уходить он должен так же плавно,
  // как пришёл, поэтому закрытие идёт через .is-closing (см. src/useClosing.js).
  const { cls: closingCls, close } = useClosing(onClose, SCREEN_CLOSE_MS)

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
    const onKey = (e) => { if (e.key === "Escape") close() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [close])

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
  const btn = `press-tap p-1.5 rounded-lg ${darkBg ? "hover:bg-white/10" : "hover:bg-blue-500/[0.07]"}`
  return (
    <div className={`fixed inset-0 z-[100001] flex flex-col screen-fade ${closingCls}`} style={{ background: bg }}>
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
          {onOpenBoard && (
            // Из прошлого занятия можно уйти на живую доску: разбор продолжают
            // на ней, а снимок правкам не поддаётся
            <button onClick={() => { close(); setTimeout(onOpenBoard, SCREEN_CLOSE_MS) }}
              title="Открыть доску" className={btn}>
              <Icon name="clipboard" size={16} />
            </button>
          )}
          <button onClick={download} title="Скачать PNG" className={btn}>
            <Icon name="download" size={16} />
          </button>
          <button onClick={close} title="Закрыть" className={btn}>
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

// onOpenBoard — открыть ЖИВУЮ доску ученика. ПОСЛЕДНИЙ снимок и есть живая
// доска: холст у ученика один и между занятиями не стирается, поэтому верхняя
// карточка ведёт прямо на него, а не в просмотр «только чтение» — разбор
// продолжают карандашом, а не разглядыванием картинки. Привязывать это к
// «сегодня» нельзя: занятие было вчера, карточку открывают сегодня, и человек
// ждёт ту же доску, а не картинку с неё.
function BoardHistory({ studentId, studentName, account = null, token = null, onOpenBoard = null }) {
  const [rows, setRows] = useState([])
  const [open, setOpen] = useState(null)     // { date, scene }
  const [loadingDate, setLoadingDate] = useState(null)
  const [askDelete, setAskDelete] = useState(null)   // дата снимка, который просят удалить
  // Удаляет только репетитор: доски занятий — его летопись, и ученику не за чем
  // стирать разобранное. У ученика и RPC такого нет, поэтому кнопки просто нет.
  const canDelete = !(account && token)

  useEffect(() => {
    if (!studentId) return
    let alive = true
    const query = account && token
      ? supabase.rpc("board_snapshot_list", { p_account: account, p_token: token, p_student_id: String(studentId) })
      : supabase.from("board_snapshots")
        .select("lesson_date, preview")
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
      if (scene) setOpen({ date, scene: await signBoardScene(scene) })
    } finally {
      setLoadingDate(null)
    }
  }

  // Снимок за сегодня — это ЖИВАЯ доска: запись за день мы убираем, но холст
  // не трогаем, иначе кнопка «удалить занятие из истории» стирала бы то, что
  // сейчас на экране у ученика. Закроют доску снова — снимок появится заново.
  async function removeDate(date) {
    setAskDelete(null)
    const { error } = await supabase.from("board_snapshots")
      .delete().eq("student_id", String(studentId)).eq("lesson_date", date)
    if (error) return
    setRows((rs) => rs.filter((r) => r.lesson_date !== date))
    setOpen((o) => (o && o.date === date ? null : o))
  }

  if (!rows.length) return null

  // Список приходит от новых к старым (и таблицей, и RPC), поэтому живая доска —
  // это первая карточка.
  const liveDate = rows[0]?.lesson_date || null

  return (
    <div className="glass p-4">
      <h2 className="text-sm font-medium mb-3">Доски занятий</h2>
      {/* Доски едут лентой вбок: занятий за год набирается много, и сеткой они
          вытеснили бы со страницы всё остальное. Карточка фиксированной ширины,
          скролл липнет к началу карточки. */}
      <div className="no-scrollbar overflow-x-auto snap-x snap-mandatory -mx-4 px-4">
        <div className="flex gap-3 w-max">
          {rows.map((r) => (
            // Кнопка удаления не может лежать ВНУТРИ карточки-кнопки (вложенные
            // button), поэтому карточка и крестик — соседи в общей обёртке.
            <div key={r.lesson_date} className="relative snap-start w-[46vw] max-w-[210px] sm:w-[210px]">
              <button
                onClick={() => (onOpenBoard && r.lesson_date === liveDate ? onOpenBoard() : openDate(r.lesson_date))}
                title={onOpenBoard && r.lesson_date === liveDate ? "Открыть доску" : "Посмотреть снимок"}
                className="press-fill glass-sm rounded-2xl overflow-hidden text-left w-full block">
                <div className="aspect-[16/10] bg-white dark:bg-white/5 flex items-center justify-center overflow-hidden">
                  {r.preview
                    ? <img src={r.preview} alt="" className="w-full h-full object-cover" />
                    : <Icon name="clipboard" size={20} className="text-gray-400" />}
                </div>
                {/* Справа только ожидание: число штрихов сцены пользователю
                    ничего не говорит, а читалось как сумма или оценка. */}
                <div className="px-2.5 py-2 flex items-center justify-between gap-2 min-h-[34px]">
                  <span className="text-xs font-medium truncate">{humanDate(r.lesson_date)}</span>
                  {loadingDate === r.lesson_date && (
                    <span className="loader-dots text-gray-400"><i /><i /><i /></span>
                  )}
                </div>
              </button>
              {canDelete && (
                // Видна всегда, а не по наведению: на телефоне hover нет, а прятать
                // единственный способ убрать доску за долгое нажатие нельзя.
                // position — стилем: .press-tap в index.css ставит relative и
                // перебивает утилиту absolute, кнопка уезжала под карточку.
                <button onClick={() => setAskDelete(r.lesson_date)} title="Удалить доску"
                  aria-label={`Удалить доску за ${humanDate(r.lesson_date)}`}
                  style={{ position: "absolute" }}
                  className="press-tap top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center
                    bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur ring-1 ring-gray-200/70 dark:ring-white/10
                    text-gray-400 hover:text-red-500">
                  <Icon name="x" size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      {open && (
        <BoardSnapshotView scene={open.scene} date={open.date} studentName={studentName}
          onOpenBoard={onOpenBoard} onClose={() => setOpen(null)} />
      )}
      <ConfirmModal
        open={!!askDelete}
        title="Удалить доску?"
        message={askDelete
          ? (askDelete === liveDate
            ? "Снимок исчезнет из истории. Сама доска останется — то, что на ней нарисовано, никуда не денется."
            : `Доска за ${humanDate(askDelete)} исчезнет у вас и у ученика. Восстановить её будет нельзя.`)
          : ""}
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        danger
        zIndex={100002}
        onConfirm={() => removeDate(askDelete)}
        onCancel={() => setAskDelete(null)}
      />
    </div>
  )
}

export default BoardHistory
