// Журнал согласий: единственное место, которое пишет в user_consents.
// Галочки живут в components/ConsentChecks.jsx, здесь — только фиксация факта.

import { supabase } from "./supabase"

// Редакция юридических документов, на которую даётся согласие. Меняется вместе
// с текстами в Legal.jsx — по ней потом видно, с чем именно человек согласился.
export const CONSENT_VERSION = "2026-08-13"

// Фиксируем факт, дату и редакцию документов (ст. 9 152-ФЗ). Best-effort:
// пока supabase/user_consents.sql не выполнен, таблицы нет — форму это ронять
// не должно, поэтому ошибку записи глотаем осознанно.
export async function logConsent({
  role,               // 'tutor' | 'student' | 'parent' | 'lead' | 'tutor_for_student'
  subjectId = null,   // id аккаунта, если он уже создан
  contact = null,     // email или телефон, как человек его оставил
  terms = true,
  personalData = true,
  guardian = null,    // 18+ либо согласие законного представителя
  marketing = false,
}) {
  try {
    await supabase.from("user_consents").insert({
      subject_role: role,
      subject_id: subjectId,
      contact,
      doc_version: CONSENT_VERSION,
      terms,
      personal_data: personalData,
      guardian,
      marketing,
      user_agent: navigator.userAgent,
    })
  } catch {
    // журнал согласий не критичен для работы самой формы
  }
}
