// Квитанции за проведённые занятия: общие правила для кабинета ученика,
// кабинета родителя и страницы «Финансы» репетитора.
//
// Главное правило: КВИТАНЦИЯ НЕ ХРАНИТ, ОПЛАЧЕНА ЛИ ОНА. Долг во всём
// приложении считает одна функция — studentDebt() из billing.js (там же
// учитывается абонемент: он меняет не сумму, а момент начисления). Если бы
// квитанция несла собственный флаг «оплачено», он бы разъезжался с этим числом
// при правке цены, удалении занятия или платеже задним числом, и ученик видел
// бы одно, а репетитор другое.
//
// Поэтому непогашенный долг раскладывается по квитанциям от новых к старым:
// свежие занятия ещё ждут оплаты, старые уже закрыты. Ровно тот же порядок, в
// котором getUnpaidLessons() на «Финансах» показывает репетитору неоплаченные
// занятия, — просто с другой стороны.

import { studentDebt } from "./billing.js"

export const fmtMoney = (n) => Math.round(Number(n) || 0).toLocaleString("ru-RU")

// Номер квитанции для печатного документа: дата занятия + хвост id. Короткий,
// не подряд идущий (нумерация по порядку требовала бы блокировки на вставке) и
// однозначно указывающий на строку в базе.
export function invoiceNumber(invoice) {
  const date = String(invoice.lesson_date || "").replace(/-/g, "").slice(2)
  const tail = String(invoice.id || "").replace(/-/g, "").slice(0, 4).toUpperCase()
  return `${date}-${tail}`
}

// Долг считает billing.js — там же живут абонементы, и квитанции обязаны
// показывать ровно то же число. Реэкспорт, чтобы экраны, читавшие долг отсюда,
// не переучивались.
export { studentDebt }

// Раскладывает долг по квитанциям (новые — первыми). У каждой появляется:
//   due    — сколько по ней ещё не пришло,
//   status — "paid" | "partial" | "unpaid".
export function withPaymentState(invoices, student) {
  const active = (invoices || [])
    .filter((i) => !i.canceled_at)
    .sort((a, b) => String(b.lesson_date).localeCompare(String(a.lesson_date))
      || String(b.lesson_time || "").localeCompare(String(a.lesson_time || "")))

  let left = Math.max(0, studentDebt(student))
  return active.map((invoice) => {
    const amount = Number(invoice.amount) || 0
    const due = Math.min(amount, left)
    left -= due
    return {
      ...invoice,
      amount,
      due,
      status: due <= 0 ? "paid" : due < amount ? "partial" : "unpaid",
    }
  })
}

export function totalDue(invoices) {
  return (invoices || []).reduce((sum, i) => sum + (Number(i.due) || 0), 0)
}

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня",
                "июля", "августа", "сентября", "октября", "ноября", "декабря"]

// «20 августа 2026» — для печатной квитанции; в списках хватает «20.08».
export function longDate(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number)
  if (!y) return ""
  return `${d} ${MONTHS[m - 1]} ${y}`
}

export function shortDate(iso) {
  const [, m, d] = String(iso || "").split("-")
  return d && m ? `${d}.${m}` : ""
}
