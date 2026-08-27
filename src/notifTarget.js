// Куда вести по нажатию на уведомление.
//
// Экран определяется по заголовку: тексты уведомлений пишет тот же код, что и
// эти правила, а колонки «куда вести» в таблице `notifications` нет — заводить
// её ради этого значило бы мигрировать базу и переписывать все места отправки.
// Поэтому правило одно: ДОБАВИЛ НОВЫЙ ЗАГОЛОВОК — ДОБАВЬ ЕГО СЮДА, иначе
// уведомление окажется тупиком (именно так и вышло с переносом занятий).

// «перенос», «перенести», «перенесено» — общего корня у них нет, поэтому
// проверяем все три. Третий нужен ради уже разосланных уведомлений: заголовок
// «Занятие перенесено» слался, пока перенос делался без согласования.
export function isMoveNotification(title) {
  const t = (title || "").toLowerCase()
  return t.includes("перенос") || t.includes("перенест") || t.includes("перенесен")
}

// Блок, к которому прокручиваем после перехода: экран длинный, и без прокрутки
// нужная карточка осталась бы ниже видимой части.
export const MOVE_ANCHOR_TUTOR = "move-requests"
export const MOVE_ANCHOR_STUDENT = "lessons-card"

// Прокрутить к блоку и мигнуть им. Вкладка рисуется не в этом кадре, поэтому
// элемент ждём — иначе прокрутка попадала бы в пустоту при первом открытии.
export function revealBlock(id, tries = 12) {
  const el = document.getElementById(id)
  if (!el) {
    if (tries > 0) setTimeout(() => revealBlock(id, tries - 1), 60)
    return
  }
  el.scrollIntoView({ behavior: "smooth", block: "center" })
  el.classList.add("attention-flash")
  setTimeout(() => el.classList.remove("attention-flash"), 1800)
}
