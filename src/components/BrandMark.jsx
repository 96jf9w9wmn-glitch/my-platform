import BetaBadge from "./BetaBadge"

/* Логотип, название кабинета и метка «Бета».
   Метка стоит ПОД названием, а не рядом с ним: в строку они не помещались.
   Боковое меню шириной 13rem оставляет за логотипом и меткой 78 px, а «Мой
   кабинет» требует 94 — и название переносилось на две строки (замерено в
   Chromium и WebKit). В шапке на телефоне то же самое при ширине экрана до
   390 px. Колонка отдаёт названию все 134 px, а ряд не вырастает: строка без
   интерлиньяжа плюс метка — те же 32 px, что у логотипа. Название не
   переносится никогда, на совсем узком экране оно обрывается многоточием. */
function BrandMark({ title, titleClass = "text-gray-600", className = "" }) {
  return (
    <div className={`flex items-center gap-2.5 min-w-0 ${className}`}>
      <img src="/logo.webp" alt="Логотип" className="w-8 h-8 rounded-xl object-cover flex-shrink-0" />
      <div className="flex flex-col items-start gap-1 min-w-0">
        <span className={`text-sm font-semibold leading-none tracking-wide truncate max-w-full ${titleClass}`}>
          {title}
        </span>
        <BetaBadge size="xs" />
      </div>
    </div>
  )
}

export default BrandMark
