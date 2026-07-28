import { useState, useEffect } from "react"
import Icon from "./Icon"
import { supabase } from "../supabase"

// Карточка «Онлайн-оплата» на странице финансов репетитора.
//
// Здесь только выключатель и журнал заказов: ключи магазина ЮKassa лежат в
// переменных окружения Vercel и в базу не попадают — поэтому состояние
// подключения спрашиваем у сервера (GET /api/yookassa), а не у таблицы.
//
// Успешные платежи сюда не дублируются как «деньги»: вебхук дописывает их прямо
// в историю ученика, и они уже посчитаны в доходе выше. Этот журнал — про
// статусы: что оплачено, что зависло, что отменено.

const fmt = (n) => Math.round(n || 0).toLocaleString("ru-RU")

const STATUS = {
  succeeded: { label: "Оплачен", cls: "bg-green-500/12 text-green-700 dark:text-green-300 ring-green-500/20" },
  pending:   { label: "Ожидает", cls: "bg-blue-500/12 text-blue-600 dark:text-blue-400 ring-blue-500/20" },
  canceled:  { label: "Отменён", cls: "bg-gray-500/10 text-gray-500 ring-gray-500/20" },
}

export default function OnlinePaySettings({ tutorId }) {
  const [health, setHealth] = useState(null)     // null = ещё спрашиваем
  const [enabled, setEnabled] = useState(false)
  const [maxLessons, setMaxLessons] = useState(10)
  const [orders, setOrders] = useState([])
  const [ready, setReady] = useState(false)      // миграция yookassa.sql выполнена
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/yookassa").then((r) => r.json()).then(setHealth).catch(() => setHealth({ ok: false }))
  }, [])

  useEffect(() => {
    if (!tutorId) return
    let alive = true

    supabase.from("tutor_payment_settings")
      .select("online_enabled, max_lessons")
      .eq("tutor_id", tutorId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return
        if (!error) setReady(true)
        if (data) {
          setEnabled(Boolean(data.online_enabled))
          setMaxLessons(data.max_lessons || 10)
        }
      })

    supabase.from("payment_orders")
      .select("id, student_name, amount, lessons, status, created_at")
      .eq("tutor_id", tutorId)
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => { if (alive && data) setOrders(data) })

    return () => { alive = false }
  }, [tutorId])

  async function save(next) {
    if (!tutorId) return
    setSaving(true)
    const patch = { tutor_id: tutorId, online_enabled: enabled, max_lessons: maxLessons, updated_at: new Date().toISOString(), ...next }
    setEnabled(patch.online_enabled)
    setMaxLessons(patch.max_lessons)
    const { error } = await supabase.from("tutor_payment_settings").upsert(patch)
    if (error) setReady(false)   // таблицы ещё нет — покажем подсказку про миграцию
    setSaving(false)
  }

  const mode = health?.mode === "live" ? "Боевой магазин" : "Тестовый магазин"

  return (
    <div className="glass p-5 flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-medium">Онлайн-оплата</h2>
          {health && (
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 ring-inset ${
              !health.ok ? "bg-amber-500/12 text-amber-600 dark:text-amber-300 ring-amber-500/25"
                : health.mode === "live" ? "bg-green-500/12 text-green-700 dark:text-green-300 ring-green-500/25"
                : "bg-blue-500/12 text-blue-600 dark:text-blue-400 ring-blue-500/25"
            }`}>
              {health.ok ? mode : "Не настроено"}
            </span>
          )}
        </div>

        {/* Тумблер: ученик видит кнопку оплаты только когда он включён */}
        <button
          type="button"
          onClick={() => save({ online_enabled: !enabled })}
          disabled={saving || !health?.ok}
          aria-label={enabled ? "Выключить приём оплаты" : "Включить приём оплаты"}
          className={`no-press relative w-12 h-7 rounded-full transition-colors disabled:opacity-40 active:scale-[0.96] ${
            enabled ? "bg-[#007AFF]" : "bg-black/[0.12] dark:bg-white/[0.16]"
          }`}
        >
          <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${enabled ? "translate-x-5" : ""}`} />
        </button>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        Ученик платит картой или через СБП, деньги приходят на ваш счёт в ЮKassa. Оплата попадает в историю автоматически.
      </p>

      {!health?.ok && health && (
        <div className="text-xs text-amber-600 dark:text-amber-300 bg-amber-500/10 ring-1 ring-inset ring-amber-500/20 rounded-xl px-3 py-2.5 mb-4">
          Ключи магазина не заданы. Добавьте YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY в переменные окружения Vercel — инструкция в README.
        </div>
      )}
      {!ready && (
        <div className="text-xs text-amber-600 dark:text-amber-300 bg-amber-500/10 ring-1 ring-inset ring-amber-500/20 rounded-xl px-3 py-2.5 mb-4">
          Не выполнена миграция supabase/yookassa.sql — заказы негде хранить.
        </div>
      )}

      {enabled && (
        <div className="flex items-center gap-2 mb-4 -mt-1">
          <span className="text-xs text-gray-500 shrink-0">Максимум за раз</span>
          <div className="flex items-center gap-1.5">
            {[5, 10, 20].map((n) => (
              <button key={n} onClick={() => save({ max_lessons: n })}
                className={`no-press text-xs font-medium px-2.5 py-1 rounded-full transition active:scale-95 ${
                  maxLessons === n
                    ? "bg-blue-500/12 text-blue-600 dark:text-blue-400 ring-1 ring-inset ring-blue-500/25"
                    : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                }`}>
                {n} зан.
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto">
        {orders.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-4">Онлайн-платежей пока не было</div>
        ) : (
          <div className="flex flex-col gap-0.5 max-h-56 overflow-y-auto">
            {orders.map((o) => {
              const s = STATUS[o.status] || STATUS.pending
              return (
                <div key={o.id} className="flex items-center justify-between gap-2 py-2 border-b border-gray-100 dark:border-white/[0.06] last:border-0">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{o.student_name || "Ученик"}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(o.created_at).toLocaleDateString("ru-RU")}
                      {o.lessons ? ` · ${o.lessons} зан.` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 ring-inset ${s.cls}`}>{s.label}</span>
                    <span className="text-sm font-medium tabular-nums">{fmt(o.amount)} ₽</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {health?.ok && !health.receipts && (
        <div className="flex items-start gap-1.5 text-[11px] text-gray-400 mt-3">
          <Icon name="alert-triangle" size={13} className="mt-0.5 shrink-0" />
          <span>Чеки по 54-ФЗ не отправляются: включите «Отправку чеков» в кабинете ЮKassa и поставьте YOOKASSA_RECEIPT=1.</span>
        </div>
      )}
    </div>
  )
}
