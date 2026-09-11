// Приложения к заданию банка: чертёж, программа, архив, таблица, текстовый файл
// и общий текст для чтения.
//
// Общий компонент, потому что одно и то же задание показывается в трёх местах:
// просмотр банка у владельца (TaskGenPreview), сборка домашней работы у
// репетитора и сама работа у ученика. Разъедутся копии — ученик получит задание
// не в том виде, в каком его собрал репетитор.
//
// Ничего не грузится на сервер: чертёж приходит из генератора как data-URI
// (SVG внутри строки), а .zip/.xlsx/.txt собираются в браузере в момент
// нажатия. Поэтому задание целиком помещается в одну строку базы
// (homework.bank_tasks) и живёт без Storage и подписанных ссылок.
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import Icon from "./Icon"
import MorphIcon from "./MorphIcon"
import Reveal from "./Reveal"
import { taskFiles } from "../pages/taskFiles"
import { useClosing } from "../useClosing"

// Копирование текста: сперва Clipboard API (secure context + жест), иначе — execCommand.
function copyText(text) {
  try {
    const ta = document.createElement("textarea")
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"
    document.body.appendChild(ta); ta.select()
    const ok = document.execCommand("copy")
    document.body.removeChild(ta)
    return ok
  } catch { return false }
}

// Блок кода одного языка с кнопкой «Копировать» (как на решуОГЭ). C++ — во всю ширину.
export function CodeBlock({ name, code, wide }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1200) }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code).then(done).catch(() => { if (copyText(code)) done() })
    } else if (copyText(code)) { done() }
  }
  return (
    <div className={`rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1c1c1e] overflow-hidden ${wide ? "sm:col-span-2" : ""}`}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 dark:border-white/10">
        <span className="text-xs font-semibold text-gray-600">{name}</span>
        <button onClick={copy} title="Скопировать код"
          className="no-press flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-blue-600 transition active:scale-95">
          <MorphIcon from="clipboard" size={13} active={copied} />
          {copied ? "Скопировано" : "Копировать"}
        </button>
      </div>
      {/* Длинные строки (C++, Паскаль) переносим, а не прячем за горизонтальным скроллом:
          в колонке шириной в половину карточки скроллилась почти каждая программа. */}
      <pre className="px-3 py-2.5 text-xs font-mono text-gray-800 whitespace-pre-wrap break-words leading-relaxed">{code}</pre>
    </div>
  )
}

export function ProgramGrid({ blocks }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-1">
      {blocks.map((b, i) => <CodeBlock key={b.name} name={b.name} code={b.code} wide={i === blocks.length - 1} />)}
    </div>
  )
}

// Раскрывающийся общий текст (чтение, литература) — целиком в карточке он
// вытеснил бы само задание.
export function Expandable({ label, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="no-press flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition active:scale-95"
      >
        <Icon name="book" size={15} className={`transition-transform ${open ? "rotate-6" : ""}`} />
        {open ? "Свернуть текст" : label}
      </button>
      <Reveal value={open}>{() => (
        <div className="mt-2 rounded-xl border border-gray-100 dark:border-white/10 p-3 text-sm text-gray-700 leading-relaxed">
          {children}
        </div>
      )}</Reveal>
    </div>
  )
}

// Тон кнопки по породе файла — тот же, что был у каждой из них по отдельности.
const FILE_TONE = {
  archive: ["border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100", "text-blue-400"],
  spreadsheet: ["border-green-200 bg-green-50 text-green-700 hover:bg-green-100", "text-green-500"],
  text: ["border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100", "text-amber-500"],
}

// Кнопка скачивания одного приложенного файла.
export function FileButton({ file }) {
  const [tone, hint] = FILE_TONE[file.kind] || FILE_TONE.text
  return (
    <button
      onClick={file.download}
      className={`no-press self-start flex items-center gap-2 mt-1 px-3 py-2 rounded-xl border text-sm font-medium transition active:scale-95 ${tone}`}>
      <Icon name="download" size={15} />
      {file.name}
      <span className={`text-[11px] ${hint}`}>({file.hint})</span>
    </button>
  )
}

// Картинка бывает двух пород, и это разные вещи.
//
// ЧЕРТЁЖ идёт ПРИ условии: условие набрано текстом, а рисунок его дополняет. У
// SVG из генератора ширина своя и осмысленная (300–600 px) — ограничивать
// нечего. А растровый рисунок (сканы ФИПИ, /tire-fig1.png — 1833 px) по одному
// `max-w-full` разъезжается во всю ширину карточки и вытесняет само задание,
// поэтому ему нужен потолок.
//
// УСЛОВИЕ-КАРТИНКА — это само задание и есть: так приходит работа, нарезанная
// из файла репетитора (`bank_tasks[].image_url` без текста, см. homeworkSplit).
// Там внутри картинки напечатан весь текст задания, и потолок в 384 px делал её
// нечитаемой — ученик видел марку вместо условия. Такой картинке отдаём всю
// ширину колонки, а по нажатию открываем на весь экран.
const isConditionImage = (task) =>
  !!task.image_url && !task.condition_text && !task.condition_tail && !task.program && !task.source_text

const imageWidth = (url, compact) =>
  compact || !url.startsWith("data:image/svg")
    ? "max-w-full sm:max-w-sm"
    : "max-w-full"

// Условие во весь экран. Второй шаг увеличения нужен телефону: даже во всю
// ширину экрана лист А4 остаётся мелким, а разводить руками страницу кабинета
// — не то же самое, что приблизить условие.
function ImageZoom({ src, alt, onClose }) {
  const { close, cls } = useClosing(onClose)
  const [big, setBig] = useState(false)
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") close() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [close])
  return createPortal(
    <div className={`fixed inset-0 z-[100020] glass-overlay overflow-auto ${cls}`} onClick={close}>
      {/* Приближённая картинка ШИРЕ экрана — её и надо прокручивать, поэтому у
          неё снят flex-shrink (иначе flex ужимает её обратно по ширине окна) и
          снято выравнивание по центру: центрированный оверфлоу прячет левый
          край так, что до него не доскроллить. */}
      <div className={`min-h-full p-3 sm:p-6 flex ${big ? "items-start justify-start" : "items-center justify-center"}`}>
        <img
          src={src}
          alt={alt}
          onClick={(e) => { e.stopPropagation(); setBig((v) => !v) }}
          style={{ width: big ? "260%" : "100%" }}
          className={`h-auto shrink-0 ${big ? "" : "max-w-[1100px]"} rounded-xl bg-white shadow-lg transition-[width] duration-200 ${big ? "cursor-zoom-out" : "cursor-zoom-in"}`}
        />
      </div>
      <button onClick={close} title="Закрыть"
        className="no-press fixed top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center bg-white/85 dark:bg-black/50 text-gray-500 ring-1 ring-gray-200/70 dark:ring-white/10 transition active:scale-90">
        <Icon name="x" size={16} />
      </button>
      {/* Приближение — видимой кнопкой, а не одним лишь нажатием по картинке:
          догадаться о нём неоткуда, а на телефоне без него условие мелкое. */}
      <button onClick={(e) => { e.stopPropagation(); setBig((v) => !v) }}
        className="no-press fixed bottom-4 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium bg-white/90 dark:bg-black/50 text-blue-600 dark:text-blue-300 ring-1 ring-gray-200/70 dark:ring-white/10 shadow-sm transition active:scale-95">
        <Icon name={big ? "pull-in" : "maximize"} size={13} />
        {big ? "Уменьшить" : "Приблизить"}
      </button>
    </div>,
    document.body,
  )
}

// Сама картинка в карточке: чертёж — как был, условие-картинка — во всю ширину
// и с открытием на весь экран.
function TaskImage({ task, alt, compact }) {
  const [zoom, setZoom] = useState(false)
  const whole = isConditionImage(task)
  if (!whole) {
    return (
      <img src={task.image_url} alt={alt}
        className={`h-auto self-start rounded-lg border border-gray-100 dark:border-white/10 bg-white mt-1 ${imageWidth(task.image_url, compact)}`} />
    )
  }
  // Подпись под картинкой, а не одна лишь «догадайся, что она нажимается»:
  // на телефоне лист А4 в колонке кабинета мелкий, и увеличение обязано иметь
  // видимую точку входа.
  return (
    <>
      <button type="button" onClick={() => setZoom(true)} title="Открыть условие целиком"
        className="no-press block w-full mt-1 rounded-lg overflow-hidden border border-gray-100 dark:border-white/10 bg-white transition active:scale-[0.995] cursor-zoom-in">
        <img src={task.image_url} alt={alt} className="w-full h-auto block" />
      </button>
      <button type="button" onClick={() => setZoom(true)}
        className="no-press self-start inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:opacity-70 active:scale-95 transition">
        <Icon name="maximize" size={11} />Открыть крупнее
      </button>
      {zoom && <ImageZoom src={task.image_url} alt={alt} onClose={() => setZoom(false)} />}
    </>
  )
}

// Всё приложенное к заданию разом, в том же порядке, в каком это стоит в
// печатном варианте ФИПИ: текст для чтения, архив, чертёж или программа,
// вопрос под чертежом, таблица, файлы с данными. Само условие рисует
// вызывающий — оно везде своё (у ученика это строка домашней работы, в
// просмотре банка — карточка), а `tail` — вторая половина условия, которая по
// смыслу стоит ПОД чертежом («Какое из утверждений верно?»).
export default function TaskAttachments({ task, tail = null, imageAlt = "Иллюстрация к заданию", compact = false }) {
  if (!task) return null
  // Архив стоит ДО чертежа, таблица и файлы с данными — после вопроса под ним,
  // как в печатном варианте ФИПИ.
  const files = taskFiles(task)
  const archives = files.filter((f) => f.kind === "archive")
  const rest = files.filter((f) => f.kind !== "archive")
  return (
    <>
      {task.source_text && (
        <Expandable label={task.source_title ? `Развернуть текст «${task.source_title}»` : "Развернуть текст"}>
          <div className="whitespace-pre-line">{task.source_text}</div>
        </Expandable>
      )}
      {archives.map((f) => <FileButton key={f.name} file={f} />)}
      {task.program ? (
        <ProgramGrid blocks={task.program} />
      ) : task.image_url && (
        <TaskImage task={task} alt={imageAlt} compact={compact} />
      )}
      {tail}
      {rest.map((f) => <FileButton key={f.name} file={f} />)}
    </>
  )
}
