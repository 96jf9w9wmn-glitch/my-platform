// «Вышло обновление» — плашка, когда вкладка работает на старом бандле.
//
// Зачем: раскатка меняет index.html и хэши файлов, но УЖЕ ОТКРЫТАЯ вкладка об
// этом не узнаёт никогда — она держит загруженный код до перезагрузки. Из-за
// этого правка уезжает на боевую, а на экране всё по-старому, и понять, деплой
// не доехал или страницу надо обновить, невозможно.
//
// Как определяем: у собранного файла в имени лежит хэш содержимого, и модуль
// знает своё имя (import.meta.url). Спрашиваем с сервера свежий index.html и
// сравниваем, на какой главный файл он ссылается. Разошлись — вышла новая
// версия. Никакой отдельной метки версии для этого заводить не нужно.
//
// Сами не перезагружаем: репетитор может набирать вариант или сообщение в чате,
// и внезапная перезагрузка стёрла бы введённое. Показываем кнопку.
import { useEffect, useState } from "react"
import Icon from "./Icon"
import { useClosing } from "../useClosing"

const MAIN_RE = /assets\/(index-[A-Za-z0-9_-]+\.js)/
const CHECK_EVERY = 5 * 60 * 1000

// Имя главного файла, на котором работает эта вкладка.
function currentMain() {
  const m = MAIN_RE.exec(import.meta.url || "")
  return m ? m[1] : null
}

async function deployedMain() {
  const res = await fetch("/", { cache: "no-store" })
  if (!res.ok) return null
  const m = MAIN_RE.exec(await res.text())
  return m ? m[1] : null
}

export default function UpdateToast() {
  const [stale, setStale] = useState(false)
  const { cls: closingCls, close } = useClosing(() => setStale(false))

  useEffect(() => {
    const mine = currentMain()
    // В dev имя файла без хэша — сравнивать нечего.
    if (!mine) return
    let last = 0
    let alive = true

    // Скрытую вкладку не пропускаем намеренно: запрос — маленький index.html раз
    // в пять минут, зато встроенные браузеры и «домашние экраны» иногда считают
    // себя скрытыми всегда, и проверка бы не срабатывала вообще никогда.
    async function check() {
      if (!alive) return
      const now = Date.now()
      if (now - last < CHECK_EVERY) return
      last = now
      try {
        const theirs = await deployedMain()
        if (alive && theirs && theirs !== mine) setStale(true)
      } catch { /* нет сети — не наше дело, вкладка просто работает как работала */ }
    }

    // Возврат к вкладке — самый частый момент, когда деплой уже случился.
    const onVisible = () => { if (!document.hidden) check() }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)
    const timer = setInterval(check, CHECK_EVERY)
    check()

    return () => {
      alive = false
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
    }
  }, [])

  if (!stale) return null

  return (
    <div className={`fixed z-[100020] left-1/2 -translate-x-1/2 bottom-[max(1rem,env(safe-area-inset-bottom))] md:left-auto md:right-5 md:translate-x-0 ${closingCls}`}>
      <div className="glass px-4 py-3 flex items-center gap-3 shadow-lg loader-wrap">
        <span className="w-8 h-8 rounded-xl bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center shrink-0">
          <Icon name="repeat" size={15} />
        </span>
        <span className="text-sm">Вышло обновление платформы</span>
        <button
          onClick={() => window.location.reload()}
          className="shrink-0 px-4 py-1.5 rounded-full text-sm font-medium text-white transition-all active:scale-95"
          style={{ background: "linear-gradient(135deg, #0A84FF 0%, #0060DF 100%)" }}
        >
          Обновить
        </button>
        <button onClick={close} aria-label="Закрыть" className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors active:scale-90">
          <Icon name="x" size={14} />
        </button>
      </div>
    </div>
  )
}
