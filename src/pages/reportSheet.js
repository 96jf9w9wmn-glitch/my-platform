// Печатный лист отчёта родителю: разметка и ничего кроме неё.
//
// Отдельно от reportPdf.js намеренно: сборка PDF тянет jspdf и html2canvas
// (около 250 кБ), а эта же разметка показывается репетитору как превью прямо
// в карточке ученика — ради превью грузить сборщик PDF незачем.

import { plural } from "../utils"

const INK = "#12161f"
const MUTED = "#8a8f98"
const LINE = "#e6e8ec"

// Уверенность по теме. Порядок важен: он же задаёт заполнение шкалы из трёх
// сегментов — «тяжело» это 1 из 3, «уверенно» — 3 из 3.
const CONF = {
  struggling: { label: "Нужна помощь", tone: "#ff3b30", soft: "#ffeceb", step: 1 },
  progress:   { label: "В процессе",   tone: "#f5a524", soft: "#fff4e2", step: 2 },
  confident:  { label: "Уверенно",     tone: "#1eaa5c", soft: "#e6f6ed", step: 3 },
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]
))

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня",
                "июля", "августа", "сентября", "октября", "ноября", "декабря"]

function longDate(iso) {
  if (!iso) return ""
  const d = new Date(String(iso).slice(0, 10) + "T00:00:00")
  if (Number.isNaN(d.getTime())) return ""
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

// Внутри одного периода год у каждой даты только шумит.
export function dayMonth(iso) {
  return longDate(iso).replace(/\s\d{4}$/, "")
}

// Сегодняшнее число по местному времени: toISOString под вечер отдаёт вчера.
function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function initials(name) {
  return String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("")
}

function periodLine(period, lessonsCount) {
  const parts = []
  if (period?.from && period?.to && period.from !== period.to) {
    parts.push(`${dayMonth(period.from)} — ${dayMonth(period.to)}`)
  } else if (period?.from || period?.to) {
    parts.push(dayMonth(period.from || period.to))
  }
  if (lessonsCount) {
    parts.push(`${lessonsCount} ${plural(lessonsCount, "занятие", "занятия", "занятий")}`)
  }
  return parts.join("  ·  ")
}

// Плитка с числом. Показываем только те, для которых данные реально есть:
// пустой прочерк в отчёте родителю читается как «репетитор не следит».
function statTile({ value, label, accent }) {
  return `
    <td style="padding:0 6px;" width="25%">
      <div style="border:1px solid ${LINE}; border-radius:16px; padding:14px 16px; background:#fbfcfd;">
        <div style="font-size:26px; font-weight:700; letter-spacing:-0.5px; color:${accent || INK}; line-height:1.1;">${esc(value)}</div>
        <div style="font-size:11.5px; color:${MUTED}; margin-top:6px; line-height:1.3;">${esc(label)}</div>
      </div>
    </td>`
}

// Шкала уверенности: три сегмента, закрашены слева направо цветом статуса.
function confBar(step, tone) {
  return [1, 2, 3].map((i) => `
    <span style="display:inline-block; width:16px; height:4px; border-radius:2px; margin-left:${i > 1 ? 3 : 0}px;
                 background:${i <= step ? tone : "#e9ebef"};"></span>`).join("")
}

function topicRow(topic, i, last) {
  // Уверенности может не быть вовсе: если ученик решает не через банк заданий,
  // объективной доли верных ответов нет, и выдумывать статус нельзя.
  const conf = CONF[topic.confidence] || null
  return `
    <tr>
      <td style="padding:${i === 0 ? 0 : 13}px 0 ${last ? 0 : 13}px; border-bottom:${last ? "none" : `1px solid ${LINE}`};">
        <table style="width:100%; border-collapse:collapse;">
          <tr>
            <td style="vertical-align:top;">
              <div style="font-size:15px; font-weight:600; color:${INK}; line-height:1.35;">${esc(topic.title || "Тема занятия")}</div>
              ${topic.comment ? `<div style="font-size:13px; color:#6b7280; line-height:1.5; margin-top:5px;">${esc(topic.comment)}</div>` : ""}
            </td>
            ${conf ? `
            <td style="vertical-align:top; text-align:right; white-space:nowrap; padding-left:18px; width:150px;">
              <span style="display:inline-block; font-size:11.5px; font-weight:600; color:${conf.tone};
                           background:${conf.soft}; border-radius:999px; padding:4px 10px;">${conf.label}</span>
              <div style="margin-top:7px;">${confBar(conf.step, conf.tone)}</div>
            </td>` : ""}
          </tr>
        </table>
      </td>
    </tr>`
}

function lessonRow(lesson) {
  return `
    <tr>
      <td style="padding:6px 0; font-size:12.5px; color:${MUTED}; width:120px; vertical-align:top;">${esc(dayMonth(lesson.date))}</td>
      <td style="padding:6px 0; font-size:13px; color:#3a3f4a; line-height:1.45;">${esc(lesson.topic || lesson.note || "Занятие проведено")}</td>
    </tr>`
}

function sectionTitle(text) {
  return `<div style="font-size:11px; color:${MUTED}; text-transform:uppercase; letter-spacing:1px; font-weight:600;">${esc(text)}</div>`
}

// Разметка листа. Экспортируется, чтобы её можно было посмотреть в браузере
// без сборки PDF (стенд при отладке вёрстки).
export function reportSheetHtml({ report, studentName, tutorName, stats = {}, lessons = [], period }) {
  const topics = Array.isArray(report?.topics) ? report.topics.filter((t) => t && (t.title || t.comment)) : []
  const tiles = [
    stats.lessons ? { value: stats.lessons, label: plural(stats.lessons, "занятие проведено", "занятия проведено", "занятий проведено") } : null,
    topics.length ? { value: topics.length, label: plural(topics.length, "тема разобрана", "темы разобрано", "тем разобрано") } : null,
    stats.homeworkDone ? { value: stats.homeworkDone, label: plural(stats.homeworkDone, "работа сдана", "работы сдано", "работ сдано") } : null,
    stats.avgGrade ? { value: String(stats.avgGrade).replace(".", ","), label: "средний балл", accent: "#007aff" } : null,
  ].filter(Boolean)

  return `
    <div style="font-family:-apple-system,'SF Pro Text',Helvetica,Arial,sans-serif; color:${INK}; background:#fff; padding:0 2px 2px;">

      <!-- цветная кромка: единственное «украшение» листа, дальше только текст -->
      <div style="height:4px; border-radius:2px; background:linear-gradient(90deg,#0a84ff,#5ac8fa 55%,#34c7a4);"></div>

      <!-- шапка -->
      <table style="width:100%; border-collapse:collapse; margin-top:17px;">
        <tr>
          <td style="vertical-align:middle;">
            <table style="border-collapse:collapse;"><tr>
              <td style="vertical-align:middle;">
                <div style="width:34px; height:34px; border-radius:10px; background:linear-gradient(135deg,#0a84ff,#0060df);
                            color:#fff; font-size:17px; font-weight:700; text-align:center; line-height:34px; letter-spacing:0.5px;">P</div>
              </td>
              <td style="vertical-align:middle; padding-left:11px;">
                <div style="font-size:15px; font-weight:700; letter-spacing:-0.2px;">Precettore</div>
                <div style="font-size:11.5px; color:${MUTED}; margin-top:1px;">Отчёт родителю</div>
              </td>
            </tr></table>
          </td>
          <td style="vertical-align:middle; text-align:right; font-size:11.5px; color:${MUTED};">
            ${esc(longDate(report?.lesson_date) || longDate(todayIso()))}
          </td>
        </tr>
      </table>

      <div style="height:1px; background:${LINE}; margin:15px 0 21px;"></div>

      <!-- кто и за какой период -->
      <table style="width:100%; border-collapse:collapse;">
        <tr>
          <td style="vertical-align:middle;">
            <div style="font-size:12px; color:${MUTED};">Ученик</div>
            <div style="font-size:29px; font-weight:700; letter-spacing:-0.7px; margin-top:5px; line-height:1.15;">${esc(studentName || "Ученик")}</div>
            ${periodLine(period, stats.lessons) ? `<div style="font-size:13px; color:#6b7280; margin-top:8px;">${esc(periodLine(period, stats.lessons))}</div>` : ""}
          </td>
          <td style="vertical-align:middle; text-align:right; width:70px;">
            <div style="width:58px; height:58px; border-radius:50%; background:#eef4ff; color:#0a84ff; display:inline-block;
                        font-size:20px; font-weight:700; text-align:center; line-height:58px; letter-spacing:0.5px;">${esc(initials(studentName))}</div>
          </td>
        </tr>
      </table>

      ${tiles.length ? `
      <table style="width:100%; border-collapse:separate; border-spacing:0; margin:22px -6px 0; table-layout:fixed;">
        <tr>${tiles.map(statTile).join("")}${
          // Пустые ячейки, чтобы три плитки не растягивались на всю ширину неровно.
          Array.from({ length: Math.max(0, 4 - tiles.length) }, () => '<td style="padding:0 6px;" width="25%"></td>').join("")
        }</tr>
      </table>` : ""}

      ${report?.summary ? `
      <div style="margin-top:26px;">
        ${sectionTitle("Коротко о главном")}
        <div style="margin-top:10px; border-radius:16px; background:#f4f8ff; border:1px solid #dfeaff; padding:16px 18px;">
          <div style="font-size:14.5px; line-height:1.6; color:#26303f;">${esc(report.summary)}</div>
        </div>
      </div>` : ""}

      ${topics.length ? `
      <div style="margin-top:26px;">
        ${sectionTitle("Темы и результат")}
        <table style="width:100%; border-collapse:collapse; margin-top:12px;">
          ${topics.map((t, i) => topicRow(t, i, i === topics.length - 1)).join("")}
        </table>
      </div>` : ""}

      ${report?.next_steps ? `
      <div style="margin-top:26px;">
        ${sectionTitle("Что дальше")}
        <table style="width:100%; border-collapse:collapse; margin-top:10px;">
          <tr>
            <td style="width:4px; background:#0a84ff; border-radius:2px;"></td>
            <td style="padding-left:16px; font-size:14px; line-height:1.6; color:#26303f;">${esc(report.next_steps)}</td>
          </tr>
        </table>
      </div>` : ""}

      ${lessons.length ? `
      <div style="margin-top:26px;">
        ${sectionTitle("Занятия за период")}
        <table style="width:100%; border-collapse:collapse; margin-top:6px;">
          ${lessons.map(lessonRow).join("")}
        </table>
      </div>` : ""}

      <div style="margin-top:26px; border-top:1px solid ${LINE}; padding-top:13px;">
        <table style="width:100%; border-collapse:collapse;">
          <tr>
            <td style="font-size:12.5px; color:#3a3f4a;">
              ${tutorName ? `Репетитор — <b style="font-weight:600;">${esc(tutorName)}</b>` : "Репетитор"}
            </td>
            <td style="text-align:right; font-size:11px; color:${MUTED};">
              Отчёт сформирован в Precettore (бета-версия) · precettore.ru
            </td>
          </tr>
        </table>
        <div style="font-size:10.5px; color:#a6abb3; line-height:1.6; margin-top:8px;">
          Оценка тем — мнение репетитора по итогам занятий, а не результат официальной аттестации.
        </div>
      </div>
    </div>`
}

