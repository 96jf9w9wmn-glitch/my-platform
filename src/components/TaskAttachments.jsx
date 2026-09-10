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
import { useState } from "react"
import Icon from "./Icon"
import MorphIcon from "./MorphIcon"
import Reveal from "./Reveal"
import { taskFiles } from "../pages/taskFiles"

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

// Ширина чертежа. У SVG из генератора она своя и осмысленная (300–600 px) —
// картинка и так не растягивается, ограничивать нечего. А растровый рисунок
// (сканы ФИПИ, /tire-fig1.png — 1833 px) по одному `max-w-full` разъезжается во
// всю ширину карточки и вытесняет само задание, поэтому ему нужен потолок.
const imageWidth = (url, compact) =>
  compact || !url.startsWith("data:image/svg")
    ? "max-w-full sm:max-w-sm"
    : "max-w-full"

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
        <img
          src={task.image_url}
          alt={imageAlt}
          className={`h-auto self-start rounded-lg border border-gray-100 dark:border-white/10 bg-white mt-1 ${imageWidth(task.image_url, compact)}`}
        />
      )}
      {tail}
      {rest.map((f) => <FileButton key={f.name} file={f} />)}
    </>
  )
}
