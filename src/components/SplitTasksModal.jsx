import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useClosing } from "../useClosing"
import Icon from "./Icon"
import Reveal from "./Reveal"
import { splitSource, buildTasks, MAX_PAGES } from "../pages/homeworkSplit"

// Разбор загруженного файла на задания: страницы файла с границами, которые
// репетитор видит и правит.
//
// Границы расставляет движок (pages/homeworkSplit.js), но применять их молча
// нельзя: у PDF с текстовым слоем номера читаются точно, а у фотографии
// границы — догадка по пустым местам. Ошибись она без этого экрана — ученик
// получил бы половину условия и узнал бы об этом только на проверке.
//
// Взаимодействие ровно одно: линия. Тянешь — двигаешь границу, крестик —
// убираешь, нажатие по странице — добавляешь. Всё, что выше первой линии
// (шапка листа, фамилия, дата), в задания не идёт и помечено прямо на странице.

// Пороги перетаскивания: чтобы нажатие «добавить границу» не срабатывало,
// когда палец на линии чуть дрогнул.
const DRAG_SLOP = 4

export default function SplitTasksModal({ file, onDone, onClose }) {
  const { cls: closingCls, close } = useClosing(onClose)
  const [stage, setStage] = useState("loading")
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState("")
  const [pages, setPages] = useState([])
  const [previews, setPreviews] = useState([])
  const [cuts, setCuts] = useState([])
  const [guessed, setGuessed] = useState(false)
  const [busy, setBusy] = useState(false)
  const drag = useRef(null)
  const nextId = useRef(1)

  useEffect(() => {
    let alive = true
    splitSource(file, (done, total) => alive && setProgress({ done, total }))
      .then((res) => {
        if (!alive) return
        setPages(res.pages)
        // Страницы показываем картинкой, а не живым canvas: React-дерево
        // перерисовывается на каждое движение линии, а холст с чертежом
        // пришлось бы рисовать заново.
        setPreviews(res.pages.map((p) => p.canvas.toDataURL("image/jpeg", 0.72)))
        setCuts(res.starts.map((s) => ({ id: nextId.current++, page: s.page, y: s.y })))
        setGuessed(res.guessed)
        setStage("edit")
      })
      .catch((e) => {
        if (!alive) return
        setError(e?.message || "Файл не удалось разобрать")
        setStage("error")
      })
    return () => { alive = false }
  }, [file])

  const sorted = cuts.slice().sort((a, b) => a.page - b.page || a.y - b.y)
  const orderOf = (cut) => sorted.findIndex((c) => c.id === cut.id) + 1

  function moveCut(id, page, y) {
    setCuts((prev) => prev.map((c) => (c.id === id ? { ...c, page, y } : c)))
  }

  function addCut(page, y) {
    setCuts((prev) => [...prev, { id: nextId.current++, page, y }])
  }

  function pointerY(e, pageIndex) {
    const box = e.currentTarget.getBoundingClientRect()
    const rel = (e.clientY - box.top) / box.height
    return Math.max(0, Math.min(1, rel)) * pages[pageIndex].height
  }

  function onPageDown(e, pageIndex) {
    // Нажатие мимо линии — новая граница ровно там, куда ткнули.
    if (drag.current) return
    addCut(pageIndex, pointerY(e, pageIndex))
  }

  function onHandleDown(e, cut, pageIndex) {
    e.stopPropagation()
    drag.current = { id: cut.id, page: pageIndex, startY: e.clientY, moved: false }
    // Захват указателя удерживает перетаскивание, даже если палец ушёл за
    // пределы линии. Он же иногда отказывает (указателя уже нет) — тогда
    // тащим по обычным событиям, а не роняем всё нажатие.
    try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch { /* тащим без захвата */ }
  }

  function onHandleMove(e, pageIndex) {
    const d = drag.current
    if (!d) return
    if (!d.moved && Math.abs(e.clientY - d.startY) < DRAG_SLOP) return
    d.moved = true
    const box = e.currentTarget.closest("[data-page]")?.getBoundingClientRect()
    if (!box) return
    const rel = Math.max(0, Math.min(1, (e.clientY - box.top) / box.height))
    moveCut(d.id, pageIndex, rel * pages[pageIndex].height)
  }

  function onHandleUp() { drag.current = null }

  // Палец отпущен где угодно — перетаскивание закончилось. Без этого потерянный
  // pointerup (указатель ушёл за окно) оставлял линию «прилипшей», и следующее
  // нажатие по странице не ставило новую границу.
  useEffect(() => {
    const end = () => { drag.current = null }
    window.addEventListener("pointerup", end)
    window.addEventListener("pointercancel", end)
    return () => {
      window.removeEventListener("pointerup", end)
      window.removeEventListener("pointercancel", end)
    }
  }, [])

  async function finish() {
    if (!sorted.length) return
    setBusy(true)
    // Нарезка режет и жмёт полтора десятка картинок — уступаем кадр, иначе
    // кнопка застывает без признака работы.
    await new Promise((r) => setTimeout(r, 30))
    try {
      onDone(buildTasks(pages, sorted))
      close()
    } catch (e) {
      setError(e?.message || "Не получилось собрать задания")
      setStage("error")
    } finally {
      setBusy(false)
    }
  }

  const count = sorted.length

  return createPortal(
    <div className={`fixed inset-0 glass-overlay z-[100010] overflow-y-auto ${closingCls}`}>
      <div className="min-h-full flex items-center justify-center p-4">
        <div className={`glass-modal p-5 sm:p-6 w-full max-w-3xl max-h-[92dvh] flex flex-col ${closingCls}`}>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-medium">Задания из файла</h3>
              <p className="text-xs text-gray-500 mt-1 leading-snug">
                {stage === "edit"
                  ? guessed
                    ? "Текста в файле нет, поэтому границы расставлены по пустым местам — проверьте их. Линию можно перетащить, лишнюю убрать крестиком, новую поставить нажатием на страницу."
                    : "Границы найдены по нумерации. Линию можно перетащить, лишнюю убрать крестиком, новую поставить нажатием на страницу."
                  : "Разбираем файл на отдельные задания."}
              </p>
            </div>
            <button onClick={close} title="Закрыть"
              className="no-press shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-blue-500/[0.08] transition active:scale-90">
              <Icon name="x" size={16} />
            </button>
          </div>

          {stage === "loading" && (
            <div className="flex flex-col items-center justify-center gap-3 py-14 text-sm text-gray-500">
              <div className="w-8 h-8 rounded-full border-2 border-blue-500/25 border-t-blue-600 animate-spin" />
              {progress.total
                ? `Страница ${progress.done} из ${progress.total}`
                : "Открываем файл…"}
            </div>
          )}

          {stage === "error" && (
            <div className="py-10 text-center">
              <div className="text-sm text-red-600 dark:text-red-300">{error}</div>
              <p className="text-xs text-gray-400 mt-2 leading-snug">
                Разбираются PDF и фотографии. Файл Word сначала сохраните как PDF —
                тогда задания и чертежи встанут на свои места.
              </p>
            </div>
          )}

          {stage === "edit" && (
            <>
              <div className="mt-4 flex-1 min-h-0 overflow-y-auto rounded-2xl ring-1 ring-gray-200/70 dark:ring-white/10 p-2 sm:p-3 flex flex-col gap-3">
                {previews.map((src, pageIndex) => {
                  const pageCuts = sorted.filter((c) => c.page === pageIndex)
                  // Верх первой страницы до первой границы — шапка листа, в
                  // задания она не идёт. Показываем это прямо на странице.
                  const firstCut = sorted[0]
                  const headTo = firstCut && firstCut.page === pageIndex ? firstCut.y : null
                  const skipWhole = firstCut ? pageIndex < firstCut.page : true
                  return (
                    <div key={pageIndex} data-page={pageIndex} className="relative select-none"
                      onPointerDown={(e) => onPageDown(e, pageIndex)}>
                      <img src={src} alt={`Страница ${pageIndex + 1}`} draggable={false}
                        className="w-full h-auto rounded-xl ring-1 ring-gray-200/70 dark:ring-white/10 bg-white" />

                      {(skipWhole || headTo != null) && (
                        <div className="absolute inset-x-0 top-0 rounded-t-xl bg-blue-500/[0.07] flex items-start justify-center pt-1.5 pointer-events-none"
                          style={{ height: skipWhole ? "100%" : `${(headTo / pages[pageIndex].height) * 100}%` }}>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/85 dark:bg-black/50 text-gray-500 ring-1 ring-gray-200/70 dark:ring-white/10">
                            не войдёт в задания
                          </span>
                        </div>
                      )}

                      {pageCuts.map((cut) => (
                        <div key={cut.id}
                          className="absolute inset-x-0 -translate-y-1/2 h-6 flex items-center cursor-row-resize touch-none"
                          style={{ top: `${(cut.y / pages[pageIndex].height) * 100}%` }}
                          onPointerDown={(e) => onHandleDown(e, cut, pageIndex)}
                          onPointerMove={(e) => onHandleMove(e, pageIndex)}
                          onPointerUp={onHandleUp}
                          onPointerCancel={onHandleUp}
                        >
                          <span className="shrink-0 -ml-1 z-10 min-w-6 h-6 px-1.5 rounded-full bg-blue-600 text-white text-[11px] font-semibold flex items-center justify-center shadow">
                            {orderOf(cut)}
                          </span>
                          <span className="flex-1 h-px bg-blue-600/70" />
                          <button type="button" title="Убрать границу"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); setCuts((prev) => prev.filter((c) => c.id !== cut.id)) }}
                            className="no-press shrink-0 -mr-1 z-10 w-6 h-6 rounded-full bg-white dark:bg-[#1c1c1e] ring-1 ring-blue-600/40 text-blue-600 flex items-center justify-center transition active:scale-90 hover:bg-blue-500/[0.08]">
                            <Icon name="x" size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                })}
                {pages.length >= MAX_PAGES && (
                  <div className="text-[11px] text-gray-400 text-center">
                    Показаны первые {MAX_PAGES} страниц файла.
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-4">
                <Reveal value={count ? "" : "Поставьте хотя бы одну границу — нажмите на странице там, где начинается задание."} className="min-w-0">
                  {(msg) => (
                    <div className="text-xs text-gray-500 leading-snug">{msg}</div>
                  )}
                </Reveal>
                <div className="flex flex-col-reverse sm:flex-row gap-3 sm:ml-auto">
                  <button onClick={close} className="press-fill border border-gray-200 dark:border-white/15 rounded-xl px-5 py-2.5 text-sm text-gray-600">
                    Отмена
                  </button>
                  <button onClick={finish} disabled={!count || busy}
                    className="bg-blue-600 text-white rounded-xl px-6 py-2.5 text-sm hover:bg-blue-700 disabled:opacity-50 active:scale-[0.98] transition-transform">
                    {busy ? "Собираем…" : count ? `Собрать ${count} ${plural(count)}` : "Собрать задания"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

const plural = (n) => {
  const t = n % 100
  if (t >= 11 && t <= 14) return "заданий"
  const d = n % 10
  return d === 1 ? "задание" : d >= 2 && d <= 4 ? "задания" : "заданий"
}
