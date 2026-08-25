import { useCallback, useEffect, useSyncExternalStore } from "react"
import { supabase } from "./supabase"

// Налоговый режим репетитора — один источник для трёх мест: анкеты при
// регистрации (TutorOnboardingModal), карточки «Налоговый режим» в «Профиле»
// (TaxModeSettings) и отчёта «Доход и налог» в «Финансах» (Payment).
// Ставка НПД по умолчанию 4% (доход от физлиц — обычный случай репетитора);
// на 6% (доход от юрлиц) переключается в той же карточке профиля.
export const TAX_MODES = {
  none: { label: "Без налога", hint: "Пока не оформлен", rate: 0 },
  npd: { label: "Самозанятый", hint: "НПД, 4% с физлиц", rate: 4 },
  usn6: { label: "ИП · УСН 6%", hint: "Упрощёнка «Доходы»", rate: 6 },
}

// Ставка, по которой реально считается налог: у НПД она выбирается репетитором
// (4 или 6), у остальных режимов фиксирована самим режимом.
export function effectiveTaxRate(mode, rate) {
  if (mode === "npd") return Number(rate) || TAX_MODES.npd.rate
  return TAX_MODES[mode]?.rate || 0
}

// Настройка живёт в двух разделах сразу: меняют её в «Профиле», а применяется
// она в «Финансах». Обе страницы остаются смонтированными (App держит уже
// посещённые вкладки живыми), поэтому своего useState в каждой мало — после
// смены режима «Финансы» показывали бы старый налог до перезагрузки. Держим
// один снимок на модуль и рассылаем его подписчикам.
let snap = { tutorId: null, mode: "none", rate: TAX_MODES.npd.rate, loaded: false }
const listeners = new Set()

function emit(next) {
  snap = next
  listeners.forEach((fn) => fn(next))
}

// Записываем и в базу, и в общий снимок. Ошибку глушим: до прогона finance.sql
// таблицы может не быть, и это не повод ронять анкету или карточку — режим
// останется выбранным в интерфейсе до следующей загрузки.
export async function saveTaxMode(tutorId, mode, rate) {
  const value = { tutorId, mode, rate: effectiveTaxRate(mode, rate), loaded: true }
  emit(value)
  if (!tutorId) return
  try {
    await supabase.from("tutor_finance_settings").upsert({
      tutor_id: tutorId,
      tax_mode: value.mode,
      tax_rate: value.rate,
      updated_at: new Date().toISOString(),
    })
  } catch { /* таблицы ещё нет — молча */ }
}

function subscribe(fn) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function useTaxSettings(tutorId) {
  const state = useSyncExternalStore(subscribe, () => snap)

  useEffect(() => {
    if (!tutorId || (snap.loaded && snap.tutorId === tutorId)) return
    let alive = true
    supabase.from("tutor_finance_settings")
      .select("tax_mode, tax_rate")
      .eq("tutor_id", tutorId)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return
        emit({
          tutorId,
          mode: data?.tax_mode || "none",
          rate: Number(data?.tax_rate) || TAX_MODES.npd.rate,
          loaded: true,
        })
      }, () => { /* таблицы ещё нет — остаёмся на «Без налога» */ })
    return () => { alive = false }
  }, [tutorId])

  const save = useCallback((mode, rate) => saveTaxMode(tutorId, mode, rate), [tutorId])

  return { mode: state.mode, rate: state.rate, effRate: effectiveTaxRate(state.mode, state.rate), save }
}
