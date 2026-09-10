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
//
// «Что нового»: сказать «вышло обновление» и не сказать какое — значит просить
// перезагрузиться вслепую. Список правок собирается при сборке из истории git в
// /changelog.json (см. vite.config.js), а своё место в этой истории вкладка
// знает по коммиту сборки __BUILD__ — всё, что выше него, и вышло после неё.
import { useEffect, useState } from "react"
import Icon from "./Icon"
import Reveal from "./Reveal"
import { useClosing } from "../useClosing"

const MAIN_RE = /assets\/(index-[A-Za-z0-9_-]+\.js)/
const CHECK_EVERY = 5 * 60 * 1000
// Сколько правок показывать вкладке, которой в истории уже нет (сборка старше
// шестидесяти коммитов). Честнее короткий список с оговоркой, чем длинный
// свиток, в котором половина была видна ещё до открытия вкладки.
const FALLBACK = 8

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня",
                "июля", "августа", "сентября", "октября", "ноября", "декабря"]

function dayMonth(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number)
  if (!y) return ""
  return `${d} ${MONTHS[m - 1]}${y === new Date().getFullYear() ? "" : ` ${y}`}`
}

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

// Что вышло после нашей сборки. Возвращает { list, partial }: partial — своей
// сборки в истории уже нет, показываем последние правки и говорим об этом.
async function newerChanges() {
  // SPA-фолбэк на отсутствующий файл отдаёт index.html с кодом 200, поэтому
  // разбор JSON может бросить — и это нормально: список необязателен.
  const res = await fetch("/changelog.json", { cache: "no-store" })
  if (!res.ok) return null
  const data = await res.json()
  const all = Array.isArray(data?.entries) ? data.entries : []
  if (!all.length) return null
  const mine = all.findIndex((e) => e.h === __BUILD__)
  if (mine === 0) return null // сборка та же, разошлись только имена файлов
  const slice = mine > 0 ? all.slice(0, mine) : all.slice(0, FALLBACK)
  // Одна правка иногда доезжает двумя коммитами с одним заголовком — в списке
  // это выглядит как повтор, хотя рассказывать дважды не о чем.
  const seen = new Set()
  const list = slice.filter((e) => e.t && !seen.has(e.t) && (seen.add(e.t), true))
  return list.length ? { list, partial: mine < 0 } : null
}

// Правки одного дня идут группой с одной подписью: дата у каждой строки
// повторялась бы столбиком и мешала читать сами правки.
function byDay(list) {
  const days = []
  for (const e of list) {
    const last = days[days.length - 1]
    if (last && last.d === e.d) last.items.push(e)
    else days.push({ d: e.d, items: [e] })
  }
  return days
}

export default function UpdateToast() {
  const [stale, setStale] = useState(false)
  const [news, setNews] = useState(null)
  const [open, setOpen] = useState(false)
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
        if (!alive || !theirs || theirs === mine) return
        setStale(true)
        // Список — вдогонку и молча: плашка важнее, и без него она полезна.
        try {
          const fresh = await newerChanges()
          if (alive && fresh) setNews(fresh)
        } catch { /* нет файла или он не разобрался — плашка останется без списка */ }
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
    <div className="fixed z-[100020] left-1/2 -translate-x-1/2 bottom-[max(1rem,env(safe-area-inset-bottom))] md:left-auto md:right-5 md:translate-x-0">
      {/* Стекло модалки, а не карточки: раскрытый список ложится поверх страницы,
          и сквозь полупрозрачное стекло карточек лендинг просвечивал прямо
          сквозь строки правок. Заодно у плашки появляются те же приход и уход,
          что у всех остальных всплывающих окон сайта. */}
      <div className={`glass-modal px-4 py-3 w-[min(26.5rem,calc(100vw-2rem))] ${closingCls}`}>
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-xl bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center shrink-0">
            <Icon name="repeat" size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm md:whitespace-nowrap">Вышло обновление платформы</div>
            {news && (
              <button
                onClick={() => setOpen((v) => !v)}
                className="mt-0.5 flex items-center gap-1 text-[12px] text-[#007AFF] press-tap"
              >
                {open ? "Скрыть" : `Что нового · ${news.list.length}`}
                <span className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
                  <Icon name="chevron-down" size={12} />
                </span>
              </button>
            )}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="shrink-0 px-4 py-1.5 rounded-full text-sm font-medium text-white transition-all active:scale-95"
            style={{ background: "linear-gradient(135deg, #0A84FF 0%, #0060DF 100%)" }}
          >
            Обновить
          </button>
          <button onClick={close} aria-label="Закрыть" className="shrink-0 text-gray-500 hover:text-gray-700 transition-colors active:scale-90">
            <Icon name="x" size={14} />
          </button>
        </div>

        <Reveal value={open && news ? news : null}>
          {(shown) => (
            <div className="mt-3 pt-3 border-t border-gray-200/70 dark:border-white/10 max-h-[45vh] overflow-y-auto">
              {byDay(shown.list).map((day) => (
                <div key={day.d} className="mb-2.5 last:mb-0">
                  <div className="text-[11px] font-medium text-gray-500 mb-1">{dayMonth(day.d)}</div>
                  <ul className="space-y-1.5">
                    {day.items.map((e) => (
                      <li key={e.h} className="flex gap-2 text-[13px] leading-snug">
                        <span className="mt-[6px] w-1.5 h-1.5 rounded-full bg-[#007AFF]/60 shrink-0" />
                        <span className="min-w-0">{e.t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {shown.partial && (
                <div className="mt-2 text-[11px] text-gray-500">Показаны последние правки — эта вкладка открыта давно.</div>
              )}
            </div>
          )}
        </Reveal>
      </div>
    </div>
  )
}
