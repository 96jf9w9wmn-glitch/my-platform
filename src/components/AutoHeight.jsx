import { useLayoutEffect, useRef, useState } from "react"

// Блок, который тянет свою высоту за содержимым, а не подменяет его рывком.
// Нужен там, где вкладки внутри модалки показывают куски разной длины: без
// этого окно скачком меняет размер и «прыгает» относительно центра экрана.
// Высоту меряем ResizeObserver'ом по внутреннему слою (он остаётся авто) и
// держим её на обёртке точным числом пикселей — только так height анимируется.
export default function AutoHeight({ children, className = "", duration = 320 }) {
  const inner = useRef(null)
  const last = useRef(null)
  const timer = useRef(0)
  const [height, setHeight] = useState(null)
  const [animating, setAnimating] = useState(false)

  useLayoutEffect(() => {
    const el = inner.current
    if (!el) return

    const measure = () => {
      // Именно offsetHeight: модалка появляется со scale-анимацией, и
      // getBoundingClientRect вернул бы уменьшенную высоту, которая тут же
      // застыла бы на обёртке.
      const h = el.offsetHeight
      if (last.current !== null && last.current === h) return
      const first = last.current === null
      last.current = h
      setHeight(h)
      // Первое измерение — это просто фиксация текущей высоты, анимировать нечего.
      if (first) return
      setAnimating(true)
      // Снимаем «в движении» по таймеру, а не по transitionend: событие не
      // придёт, если переход прервали новым замером или вкладка была скрыта, —
      // и overflow остался бы обрезающим навсегда.
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setAnimating(false), duration + 60)
    }

    measure()
    // Меряем прямо в колбэке наблюдателя, без requestAnimationFrame: в фоновой
    // вкладке кадры не выдаются, и высота застряла бы на прежнем значении.
    // Зациклиться нельзя — наблюдаем внутренний слой, а высоту ставим обёртке.
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => { ro.disconnect(); clearTimeout(timer.current) }
  }, [duration])

  const reduced = typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

  return (
    <div
      className={className}
      style={{
        height: height == null ? undefined : height,
        // Пока едет высота — прячем то, что не поместилось; в покое overflow
        // возвращаем, иначе обрежется тень, кольцо фокуса и выпадающий список.
        overflow: animating ? "hidden" : undefined,
        transition: reduced ? undefined : `height ${duration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
      }}
    >
      <div ref={inner}>{children}</div>
    </div>
  )
}
