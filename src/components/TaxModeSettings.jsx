import Icon from "./Icon"
import SegmentSwitch from "./SegmentSwitch"
import { TAX_MODES, useTaxSettings } from "../taxModes"

// Карточка «Налоговый режим» в разделе «Профиль».
//
// Режим спрашивается один раз при регистрации (TutorOnboardingModal), но
// оформление меняется: репетитор становится самозанятым или открывает ИП. Менять
// режим на экране «Финансы» было неверно — там рабочие числа за месяц, а это
// настройка аккаунта, которую трогают раз в год. Так же разделены квитанции и
// онлайн-оплата: настройка здесь, применение — в «Финансах».

const NPD_RATES = [
  { value: 4, label: "4% с физлиц" },
  { value: 6, label: "6% с юрлиц" },
]

export default function TaxModeSettings({ tutorId, surface = "glass p-5" }) {
  const { mode: saved, rate, effRate, save } = useTaxSettings(tutorId)
  const mode = TAX_MODES[saved] ? saved : "none"

  return (
    <div className={`${surface} flex flex-col`}>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 shrink-0 rounded-xl bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center">
          <Icon name="ruble" size={16} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium">Налоговый режим</div>
          <p className="text-xs text-gray-500 leading-relaxed mt-0.5">
            По нему в «Финансах» считается налог и прибыль чистыми.
          </p>
        </div>
      </div>

      <SegmentSwitch
        block
        size="sm"
        ariaLabel="Налоговый режим"
        value={mode}
        // Возврат к НПД с другого режима — со ставки по умолчанию: 6% в поле
        // осталось бы от УСН и молча завысило налог.
        onChange={(key) => save(key, key === "npd" && mode === "npd" ? rate : TAX_MODES[key].rate)}
        className="w-full"
        items={Object.entries(TAX_MODES).map(([key, m]) => ({ key, label: m.label }))}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {mode === "npd" ? "Ставка налога:" : TAX_MODES[mode].hint}
        </span>
        {mode === "npd" && NPD_RATES.map((r) => (
          <button
            key={r.value}
            onClick={() => save("npd", r.value)}
            className={`no-press px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-[0.94] ring-1 ring-inset ${
              rate === r.value
                ? "bg-[#007AFF]/12 text-[#007AFF] ring-[#007AFF]/25"
                : "text-gray-500 ring-gray-200 dark:ring-white/10 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <p className="text-[11px] text-gray-400 leading-relaxed mt-4 pt-3 border-t border-gray-100 dark:border-white/[0.06]">
        {effRate > 0
          ? `С дохода за месяц откладывается ${effRate}%. Расходы налоговую базу не уменьшают — и НПД, и УСН «Доходы» считаются от поступлений.`
          : "Налог не считается. Выберите режим, когда оформите деятельность."}
      </p>
    </div>
  )
}
