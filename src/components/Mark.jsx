import { useEffect, useRef, useState } from "react"

// Маркерная подсветка ключевых слов в заголовке — приём с umschool.net и
// webium.ru: за словом полоса «маркера» на нижних 45% строки. Полоса
// прорисовывается слева направо, когда заголовок въезжает в вьюпорт, и только
// один раз (см. .mark-hl в index.css).
//
// <Highlight text="Ведите всех учеников в одном месте" mark="в одном месте" />
// подсветит ровно этот кусок; остальной текст остаётся как есть, поэтому в
// заголовке физически не может оказаться больше одной подсветки.

function Mark({ tone = "blue", children }) {
  const ref = useRef(null)
  const [on, setOn] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || on) return
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect() } },
      { threshold: 0.6 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [on])

  return (
    <span ref={ref} className={`mark-hl mark-${tone}${on ? " mark-on" : ""}`}>
      {children}
    </span>
  )
}

// Подсвечивает в тексте первое вхождение mark. Если его нет — вернёт текст как есть.
export function Highlight({ text, mark, tone = "blue" }) {
  const i = mark ? text.indexOf(mark) : -1
  if (i < 0) return text
  return (
    <>
      {text.slice(0, i)}
      <Mark tone={tone}>{mark}</Mark>
      {text.slice(i + mark.length)}
    </>
  )
}

export default Mark
