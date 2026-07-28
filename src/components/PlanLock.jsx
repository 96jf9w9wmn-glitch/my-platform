// Единый вид «эта возможность на другом тарифе».
//
// Правило: не прятать возможность молча. Репетитор должен видеть, что она есть,
// на каком тарифе включается и куда нажать, — иначе платформа выглядит поломанной,
// а не бесплатной.

import Icon from "./Icon"
import { PLANS, UNLIMITED } from "../plans"
import { usePlan } from "../subscription"

// Минимальный тариф, на котором возможность включена, — считаем по самим тарифам,
// чтобы текст не разъезжался при смене их состава. Ключ может быть и флагом
// (features), и лимитом (limits: 0 — «нельзя»).
function requiredPlanName(key) {
  const plan = PLANS.find((p) =>
    p.features[key] || p.limits[key] === UNLIMITED || p.limits[key] > 0
  )
  return plan ? plan.name : "Про"
}

// Строка-подсказка внутри формы: компактная, не перекрывает содержимое.
export function PlanHint({ feature, children }) {
  const { openPlans } = usePlan()
  return (
    <div className="flex items-start gap-2 text-xs rounded-xl px-3 py-2.5 bg-[#007AFF]/[0.07] ring-1 ring-inset ring-[#007AFF]/20 text-gray-600">
      <Icon name="sparkles" size={13} className="mt-0.5 shrink-0 text-[#007AFF]" />
      <span className="flex-1">
        {children || `Доступно на тарифе «${requiredPlanName(feature)}»`}
      </span>
      <button
        onClick={openPlans}
        className="no-press shrink-0 font-medium text-[#007AFF] hover:opacity-70 transition-opacity active:scale-95"
      >
        Тарифы
      </button>
    </div>
  )
}

// Блок вместо самой возможности (история досок, отчёты родителям).
export function PlanLock({ feature, title, text }) {
  const { openPlans } = usePlan()
  const planName = requiredPlanName(feature)
  return (
    <div className="glass p-5 flex flex-col items-start gap-2">
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-xl bg-[#007AFF]/12 text-[#007AFF] flex items-center justify-center">
          <Icon name="sparkles" size={15} />
        </span>
        <h2 className="text-base font-medium">{title}</h2>
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">
        {text} Включается на тарифе «{planName}».
      </p>
      <button
        onClick={openPlans}
        className="self-start mt-1 px-4 py-2 rounded-full text-sm font-medium text-white active:scale-95 transition-transform"
        style={{ background: "linear-gradient(135deg, #0A84FF 0%, #0060DF 100%)", boxShadow: "0 6px 18px rgba(0,122,255,0.28)" }}
      >
        Посмотреть тарифы
      </button>
    </div>
  )
}
