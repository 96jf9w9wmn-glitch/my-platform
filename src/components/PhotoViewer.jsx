// Просмотр фотографий решения — все листы ОДНОГО задания под одной кнопкой.
//
// Раньше каждый снимок был своей ссылкой: у задания с двумя листами стояли две
// кнопки «№1 · 1» и «№1 · 2», и выглядело это как два разных задания, хотя
// номер один, а лист второй просто не влез в первый кадр. Теперь кнопка одна —
// на номер, — а листы перелистываются внутри окна: стрелками, смахиванием и
// клавишами, как в любой галерее.
import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Icon from "./Icon"
import { useClosing } from "../useClosing"

// Ученик прикладывает и PDF — такой файл показать картинкой нельзя, он
// открывается вкладкой браузера. Расширение смотрим ДО «?»: ссылка из
// приватного бакета подписана, и запрос тянет за собой токен.
function isViewablePhoto(url) {
  const path = String(url || "").split(/[?#]/)[0]
  return !/\.(pdf|docx?|xlsx?|pptx?|zip|txt|csv)$/i.test(path)
}

function PhotoViewer({ photos, title, start = 0, onClose }) {
  const list = photos.filter(Boolean)
  const [i, setI] = useState(Math.min(Math.max(start, 0), Math.max(list.length - 1, 0)))
  const { cls: closingCls, close } = useClosing(() => onClose?.())
  // Пока снимок не пришёл, на его месте не пустота, а рамка с той же плашкой
  // загрузки, что у листа, который едет на доску: на телефоне лист в пару
  // мегабайт едет заметное время, и пустой экран читается как сбой. Ключ — сам
  // адрес: перелистнули на несоседний лист, и индикатор должен вернуться.
  const [loaded, setLoaded] = useState({})
  const touchX = useRef(null)

  const cur = list[i]
  const many = list.length > 1
  const go = useCallback((step) => {
    setI((prev) => (prev + step + list.length) % list.length)
  }, [list.length])

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); close(); return }
      if (!many) return
      if (e.key === "ArrowLeft") { e.preventDefault(); go(-1) }
      if (e.key === "ArrowRight") { e.preventDefault(); go(1) }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [close, go, many])

  if (!list.length) return null

  // Смахивание — то, чем листают фотографии на телефоне; без него стрелки на
  // узком экране остаются единственным способом, и до второго листа надо
  // прицелиться пальцем.
  const onTouchStart = (e) => { touchX.current = e.touches[0]?.clientX ?? null }
  const onTouchEnd = (e) => {
    const from = touchX.current
    touchX.current = null
    if (from == null || !many) return
    const dx = (e.changedTouches[0]?.clientX ?? from) - from
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
  }

  const navBtn = "press-tap w-10 h-10 rounded-full ring-1 ring-white/25 text-white/90 flex items-center justify-center hover:bg-white/10 transition-colors"

  return createPortal(
    // Затемнение здесь ГУЩЕ обычного (у .glass-overlay 25 %): снимок
    // решения — это белый лист, и на светлой подложке белые стрелки, счётчик и
    // крестик просто не читались. Тон — тот же, каким сайт затемняет под
    // модалками, только у верхней границы.
    <div className={`fixed inset-0 glass-overlay z-[100020] flex flex-col ${closingCls}`}
      style={{ background: "rgba(0, 0, 0, 0.6)" }}
      onClick={close} onPointerDown={(e) => e.stopPropagation()}>
      {/* Шапка: чей это лист и какой по счёту. Нажатия внутри окна до
          затемнения не доходят — иначе перелистывание закрывало бы просмотр. */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0 text-white"
        onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{title}</div>
          {many && <div className="text-[11px] text-white/60 mt-0.5">Лист {i + 1} из {list.length}</div>}
        </div>
        <a href={cur} target="_blank" rel="noreferrer"
          title="Открыть снимок в новой вкладке"
          className="press-tap w-9 h-9 rounded-full ring-1 ring-white/25 text-white/90 flex items-center justify-center hover:bg-white/10 transition-colors flex-shrink-0">
          <Icon name="external-link" size={16} />
        </a>
        <button onClick={close} aria-label="Закрыть"
          className="press-tap w-9 h-9 rounded-full ring-1 ring-white/25 text-white/90 flex items-center justify-center hover:bg-white/10 transition-colors flex-shrink-0">
          <Icon name="x" size={18} />
        </button>
      </div>

      <div className="flex-1 min-h-0 flex items-center gap-2 px-2 pb-4"
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {many && (
          <button onClick={(e) => { e.stopPropagation(); go(-1) }} aria-label="Предыдущий лист"
            className={`${navBtn} flex-shrink-0`}>
            <Icon name="chevron-left" size={18} />
          </button>
        )}
        {/* Нажатие мимо снимка закрывает просмотр — так закрываются все окна
            сайта; нажатие по самому снимку не закрывает ничего (его увеличивают
            и рассматривают, промах был бы обиден). */}
        <div className="flex-1 min-w-0 h-full flex items-center justify-center">
          {isViewablePhoto(cur) ? (
            <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
              <img key={cur} src={cur} alt={title}
                onLoad={() => setLoaded((prev) => ({ ...prev, [cur]: true }))}
                className={`max-w-full max-h-full object-contain rounded-2xl bg-white transition-opacity duration-200 ${loaded[cur] ? "opacity-100" : "opacity-0"}`}
                style={{ maxHeight: "calc(100dvh - 120px)" }} />
              {!loaded[cur] && (
                // Индикатор — тот же, что у листа, который едет на доску: плашка с
                // тремя точками и без подписи (требование владельца — одна анимация
                // загрузки, слов не нужно). Анимация в CSS, поэтому она идёт и
                // тогда, когда главный поток занят разбором снимка.
                <div className="absolute inset-0 rounded-2xl ring-1 ring-white/20 flex items-center justify-center px-10 py-14">
                  <span className="popup-bubble flex items-center px-3 h-7 rounded-full shadow-lg"
                    style={{ background: "#2c2c2e", border: "1px solid rgba(255,255,255,.08)" }}>
                    <span className="loader-dots text-blue-500"><i /><i /><i /></span>
                  </span>
                </div>
              )}
            </div>
          ) : (
            // PDF картинкой не показать — открываем его вкладкой браузера.
            <a href={cur} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
              className="press-fill rounded-2xl ring-1 ring-white/25 px-5 py-4 text-sm text-white inline-flex items-center gap-2">
              <Icon name="file-text" size={16} />Открыть файл
            </a>
          )}
        </div>
        {many && (
          <button onClick={(e) => { e.stopPropagation(); go(1) }} aria-label="Следующий лист"
            className={`${navBtn} flex-shrink-0`}>
            <Icon name="chevron-right" size={18} />
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}

// Кнопка «показать листы этого задания». Вид задаёт место вызова (чип в разборе
// и ссылка в проверке варианта выглядят по-разному), а окно просмотра у всех
// одно — поэтому состояние живёт здесь, а не в каждой странице по-своему.
// Единственный файл, который картинкой не показать, открываем прямо ссылкой:
// лишний шаг «открылось окно → нажать „Открыть файл“» тут ни к чему.
export function PhotoButton({ photos, title, className, children, ...rest }) {
  const [open, setOpen] = useState(false)
  const list = (photos || []).filter(Boolean)
  if (!list.length) return null
  if (list.length === 1 && !isViewablePhoto(list[0])) {
    return (
      <a href={list[0]} target="_blank" rel="noreferrer" className={className} {...rest}>
        {children}
      </a>
    )
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} {...rest}>
        {children}
      </button>
      {open && <PhotoViewer photos={list} title={title} onClose={() => setOpen(false)} />}
    </>
  )
}

export default PhotoViewer
