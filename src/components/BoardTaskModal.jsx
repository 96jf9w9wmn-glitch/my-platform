import { useState, useEffect } from "react"
import { useClosing } from "../useClosing"
import { createPortal } from "react-dom"
import Icon from "./Icon"
import MorphIcon from "./MorphIcon"
import SegmentSwitch from "./SegmentSwitch"
import { renderTaskMath } from "../utils"
import { taskThemes } from "../pages/taskGenerators"
import { EXAM_GROUPS, levelOf, numbersWithGen, subjectLabel, genTask, genThemeTask, examTypeForSubject } from "../pages/examSubjects"
import { taskToImageFile, attachmentsOf, SHEET_WIDTH } from "../pages/taskSnapshot"

// Выбор задания из банка прямо на доске: предмет → номер → (необязательно) типаж,
// предпросмотр, «На доску». Задание кладётся картинкой-листом, поэтому дальше живёт
// как обычный объект доски: двигается, масштабируется, уходит в realtime и в снимок
// занятия. Ответ виден только здесь и в снимок не попадает — доску видит ученик.

// Предмет привязан к доске: у каждого ученика свой (roomId), общая запись — запасная.
// Репетитор ведёт один предмет, и выбирать его заново при каждой вставке задания
// было лишним шагом.
const PREF_KEY = "board-task-pick"
const roomKey = (roomId) => (roomId ? `${PREF_KEY}:${roomId}` : PREF_KEY)

function readPref(key) {
  try {
    const p = JSON.parse(localStorage.getItem(key) || "null")
    if (p && numbersWithGen(p.examType).length) return p
  } catch { /* испорченная запись — берём значения по умолчанию */ }
  return null
}
// Предмет: привязка этой доски → общая привязка → предмет из анкеты репетитора → ОГЭ
function loadPref(roomId, fallbackExam) {
  const pref = readPref(roomKey(roomId)) || readPref(PREF_KEY)
  if (pref) return pref
  return fallbackExam ? { examType: fallbackExam, number: null } : null
}

export default function BoardTaskModal({ dark = false, roomId = null, tutorSubject = null, tutorExamFocus = null, onInsert, onClose }) {
  const { cls: closingCls, close } = useClosing(onClose)
  const pref = loadPref(roomId, examTypeForSubject(tutorSubject, tutorExamFocus))
  const [examType, setExamType] = useState(pref?.examType || "ОГЭ")
  const [number, setNumber] = useState(pref?.number || null)
  // Привязанный предмет показывается строкой, а списки уровня и предметов
  // раскрываются кнопкой «Сменить» — обычно менять его не нужно.
  const [pickSubject, setPickSubject] = useState(false)
  const [genKey, setGenKey] = useState(null)     // конкретный типаж
  const [theme, setTheme] = useState(null)       // тема (случайный типаж внутри)
  const [openTheme, setOpenTheme] = useState(null)
  const [task, setTask] = useState(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  const level = levelOf(examType)
  const group = EXAM_GROUPS.find((g) => g.key === level) || EXAM_GROUPS[1]
  const numbers = numbersWithGen(examType)
  const themes = number != null ? taskThemes(examType, number) : null

  useEffect(() => {
    const rec = JSON.stringify({ examType, number })
    localStorage.setItem(roomKey(roomId), rec)
    localStorage.setItem(PREF_KEY, rec)
  }, [examType, number, roomId])

  // Предмет и номер уже привязаны к доске — сразу показываем задание, не заставляя
  // повторять вчерашний выбор. Ровно один раз при открытии (пустой список зависимостей):
  // на каждый рендер это выдавало бы новую задачу само по себе.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (number != null) make(number, null, null) }, [])

  // Esc закрывает выбор. Горячие клавиши доски на это время заглушены (Board), поэтому
  // без своего обработчика клавиша не делала бы ничего.
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") close() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [close])

  // Задание генерируется только по явному выбору (номер/типаж/«другое»), а не эффектом:
  // набор случайный, и эффект на каждый рендер выдавал бы новую задачу сам по себе.
  function make(nextNumber = number, nextGen = genKey, nextTheme = theme) {
    if (nextNumber == null) return
    setErr("")
    const t = nextGen ? genTask(examType, nextNumber, nextGen)
      : nextTheme ? genThemeTask(examType, nextNumber, nextTheme)
        : genTask(examType, nextNumber)
    setTask(t)
    if (!t) setErr("Для этого выбора генератор не сработал — возьмите другой типаж")
  }

  function pickExam(type) {
    setExamType(type); setNumber(null); setGenKey(null); setTheme(null)
    setOpenTheme(null); setTask(null); setErr(""); setPickSubject(false)
  }
  function pickLevel(key) {
    if (key === level) return
    const g = EXAM_GROUPS.find((x) => x.key === key)
    pickExam((g.subjects.find((s) => numbersWithGen(s.type).length) || g.subjects[0]).type)
  }
  function pickNumber(n) {
    setNumber(n); setGenKey(null); setTheme(null); setOpenTheme(null); make(n, null, null)
  }
  function pickGen(key) { setGenKey(key); setTheme(null); make(number, key, null) }
  function pickTheme(th) { setTheme(th); setGenKey(null); make(number, null, th) }
  function pickAnyType() { setGenKey(null); setTheme(null); make(number, null, null) }

  async function insert() {
    if (!task) return
    setBusy(true); setErr("")
    try {
      const file = await taskToImageFile(task, { label: subjectLabel(examType) })
      // ширину листа задаёт снимок: доска кладёт картинку в неё, а не вписывает как фото
      await onInsert(file, SHEET_WIDTH)
      close()
    } catch {
      setErr("Не получилось перенести задание на доску")
      setBusy(false)
    }
  }

  const attachments = task ? attachmentsOf(task) : []
  // Цвета карточки предпросмотра задаются явно, а не токенами gray-*: в тёмной теме
  // приложения токены инвертируются, и «светлый текст» стал бы тёмным. А карточка
  // повторяет доску, а не тему кабинета.
  const sheet = dark
    ? { bg: "#2c2c2e", border: "rgba(255,255,255,.10)", ink: "#f5f5f7", meta: "#8e8e93", code: "rgba(255,255,255,.06)" }
    : { bg: "#ffffff", border: "rgba(0,0,0,.08)", ink: "#1c1c1e", meta: "#9ca3af", code: "#f5f5f7" }
  const chip = (active, extra = "") =>
    `px-3 py-1.5 rounded-xl text-sm border transition-all active:scale-95 ${
      active
        ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/20"
        : "bg-white/70 dark:bg-white/5 border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
    } ${extra}`

  return createPortal(
    <div className={`fixed inset-0 glass-overlay z-[100010] overflow-y-auto ${closingCls}`} onPointerDown={(e) => e.stopPropagation()}>
      <div className="min-h-full flex items-center justify-center p-4">
        <div className={`glass-modal p-6 w-full max-w-lg max-h-[90dvh] overflow-y-auto ${closingCls}`}>
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center flex-shrink-0">
                <Icon name="book" size={18} />
              </div>
              <h2 className="text-lg font-medium leading-tight">Задание на доску</h2>
            </div>
            <button onClick={close} aria-label="Закрыть" className="press-tap text-gray-400 hover:text-gray-600 mt-1"><Icon name="x" size={18} /></button>
          </div>

          {/* Предмет уже привязан к доске — строкой, а не списком на пол-экрана */}
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10">
            <span className={`w-2 h-2 rounded-full shrink-0 ${group.subjects.find((s) => s.type === examType)?.dot || "bg-blue-500"}`} />
            <span className="text-sm font-medium truncate">{subjectLabel(examType)}</span>
            <button onClick={() => setPickSubject((v) => !v)}
              className="press-tap ml-auto shrink-0 text-xs text-blue-600 hover:text-blue-700">
              {pickSubject ? "Свернуть" : "Сменить"}
            </button>
          </div>

          {/* уровень и предмет — только когда предмет меняют */}
          {pickSubject && (
            <>
              <SegmentSwitch
                items={EXAM_GROUPS.map((g) => ({ key: g.key }))}
                value={level}
                onChange={pickLevel}
                ariaLabel="Уровень экзамена"
                className="mb-3"
              />
              <div className="flex flex-wrap gap-2 mb-4">
                {group.subjects.map((s) => {
                  const has = numbersWithGen(s.type).length > 0
                  return (
                    <button key={s.type} disabled={!has} onClick={() => pickExam(s.type)}
                      className={`${chip(examType === s.type, !has ? "opacity-40 cursor-not-allowed" : "")} inline-flex items-center gap-2`}>
                      <span className={`w-2 h-2 rounded-full ${examType === s.type ? "bg-white/90" : s.dot}`} />
                      {s.label}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* номер */}
          <div className="text-xs text-gray-500 mb-1.5">Номер задания</div>
          <div className="flex flex-wrap gap-2 mb-4">
            {numbers.map((n) => (
              <button key={n} onClick={() => pickNumber(n)} className={chip(number === n)}>№{n}</button>
            ))}
            {!numbers.length && <div className="text-sm text-gray-400">Для этого предмета генераторов пока нет.</div>}
          </div>

          {/* типажи выбранного номера — свёрнуты, как в банке: их бывает под сотню */}
          {number != null && themes?.length > 0 && (
            <div className="mb-4 rounded-xl border border-gray-100 bg-gray-50/60 p-2.5 flex flex-col gap-2">
              <button onClick={pickAnyType} className={`${chip(!genKey && !theme)} self-start`}>Любой типаж</button>
              {themes.map((g) => {
                const open = openTheme === g.theme
                const inside = g.items.some((it) => it.key === genKey)
                return (
                  <div key={g.theme}
                    className={`rounded-xl border transition-colors ${open || inside || theme === g.theme ? "border-blue-200 bg-white" : "border-gray-200/70 bg-white/60"}`}>
                    <div className="flex items-center gap-2 px-2.5 py-1.5">
                      <button onClick={() => setOpenTheme(open ? null : g.theme)}
                        className="flex items-center gap-1.5 min-w-0 text-left text-[13px] font-semibold text-gray-600 hover:text-gray-800 transition-colors active:scale-[0.98]">
                        <Icon name="chevron-right" size={13}
                          className={`shrink-0 text-gray-400 transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
                        <span className="truncate">{g.theme}</span>
                        <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-gray-100 text-[11px] font-medium text-gray-500">{g.items.length}</span>
                      </button>
                      <button onClick={() => { setOpenTheme(g.theme); pickTheme(g.theme) }}
                        className={`ml-auto shrink-0 px-2.5 py-1 rounded-lg text-xs border transition-all active:scale-95 ${
                          theme === g.theme ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-500 hover:bg-gray-50"
                        }`}>
                        Любое из темы
                      </button>
                    </div>
                    {open && (
                      <div className="flex flex-wrap gap-2 px-2.5 pb-2.5 pt-2 border-t border-gray-100">
                        {g.items.map((it) => (
                          <button key={it.key} onClick={() => pickGen(it.key)} className={chip(genKey === it.key)}>{it.label}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* предпросмотр — ровно то, что уедет на доску (без ответа) */}
          {task && (
            <>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-gray-500">Что уедет на доску</span>
                <button onClick={() => make()} className="press-tap inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700">
                  <Icon name="repeat" size={13} /> Другое задание
                </button>
              </div>
              <div className="rounded-2xl border p-4 mb-3" style={{ background: sheet.bg, borderColor: sheet.border }}>
                <div className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: sheet.meta }}>
                  №{task.number} · {subjectLabel(examType)}
                </div>
                {task.condition_text && (
                  <div className="text-[15px] leading-relaxed break-words whitespace-pre-wrap" style={{ color: sheet.ink }}
                    dangerouslySetInnerHTML={{ __html: renderTaskMath(task.condition_text) }} />
                )}
                {/* На тёмном листе чертёж перекрашивается тем же приёмом, что и в снимке:
                    инверсия с сохранением оттенка, а screen поверх фона карточки поднимает
                    получившийся чёрный до цвета листа — иначе в предпросмотре была бы
                    чёрная плашка, а на доске чертёж сливается с листом без неё */}
                {task.image_url && (
                  <img src={task.image_url} alt={`Задание ${task.number}`}
                    className="max-w-full h-auto rounded-lg mt-2"
                    style={dark ? { filter: "invert(1) hue-rotate(180deg)", mixBlendMode: "screen" } : undefined} />
                )}
                {task.condition_tail && (
                  <div className="text-[15px] leading-relaxed break-words whitespace-pre-wrap mt-2" style={{ color: sheet.ink }}
                    dangerouslySetInnerHTML={{ __html: renderTaskMath(task.condition_tail) }} />
                )}
                {(task.program || []).map((b) => (
                  <pre key={b.name} className="mt-2 px-3 py-2 rounded-lg text-xs font-mono whitespace-pre-wrap"
                    style={{ background: sheet.code, color: sheet.ink }}>{b.code}</pre>
                ))}
              </div>

              <div className="flex items-center gap-3 mb-4">
                <button onClick={() => setShowAnswer((v) => !v)}
                  className="press-tap text-xs text-gray-500 hover:text-gray-700 underline decoration-dotted underline-offset-4">
                  {showAnswer ? "Скрыть ответ" : "Показать ответ"}
                </button>
                {showAnswer && (
                  <span className="text-xs text-gray-600 font-mono truncate">{String(task.answer ?? "—")}</span>
                )}
              </div>

              {attachments.length > 0 && (
                <div className="flex items-start gap-2 mb-4 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-700">
                  <Icon name="warning" size={14} className="mt-0.5 flex-shrink-0" />
                  <span>К заданию прилагается {attachments.join(", ")} — файл на доску не переносится, отправьте его ученику отдельно.</span>
                </div>
              )}
            </>
          )}

          {err && <div className="text-xs text-red-500 mb-3">{err}</div>}

          <button onClick={insert} disabled={!task || busy}
            className="btn-primary w-full py-2.5 disabled:opacity-50 flex items-center justify-center gap-2">
            <MorphIcon from="plus" size={15} active={busy} />
            {busy ? "Переносим…" : number == null ? "Выберите номер задания" : "На доску"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
