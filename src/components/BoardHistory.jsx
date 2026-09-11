import { lazy, Suspense, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { supabase } from "../supabase"
import Icon from "./Icon"
import ConfirmModal from "./ConfirmModal"

// Прошлое занятие открывается ТОЙ ЖЕ доской, что и живая, только на чтение
// (проп snapshot). Раньше здесь был свой просмотр: один канвас, в который сцена
// вписывалась целиком, — за месяц занятий холст ужимался в нечитаемые крапинки,
// а увеличить его было нечем (кнопки давали 400 % от вписанного, и ни
// перетаскивания, ни щипка). Доска умеет всё это сама, поэтому второго
// просмотрщика больше нет. Грузится она отдельным куском, как и везде.
const Board = lazy(() => import("./Board"))

// История досок по ученику: что разбирали на прошлых занятиях. Живая доска одна
// (таблица boards), а сюда при закрытии откладывается снимок сцены за день —
// см. supabase/board_snapshots.sql. Открывается только на чтение: прошлый урок
// правится не карандашом, а новым занятием.
//
// Репетитор читает таблицу напрямую (RLS пускает по tutor_id), ученик — через
// RPC с session_token: аккаунты учеников не заведены в auth.users.

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"]

function todayIso() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

function humanDate(iso) {
  const [y, m, d] = String(iso).split("-").map(Number)
  if (!y || !m || !d) return String(iso)
  const now = new Date()
  if (iso === todayIso()) return "Сегодня"
  const suffix = y === now.getFullYear() ? "" : ` ${y}`
  return `${d} ${MONTHS[m - 1]}${suffix}`
}

// onOpenBoard — открыть ЖИВУЮ доску ученика. ПОСЛЕДНИЙ снимок и есть живая
// доска: холст у ученика один и между занятиями не стирается, поэтому верхняя
// карточка ведёт прямо на него, а не в просмотр «только чтение» — разбор
// продолжают карандашом, а не разглядыванием картинки. Привязывать это к
// «сегодня» нельзя: занятие было вчера, карточку открывают сегодня, и человек
// ждёт ту же доску, а не картинку с неё.
function BoardHistory({ studentId, studentName, account = null, token = null, onOpenBoard = null }) {
  const [rows, setRows] = useState([])
  const [open, setOpen] = useState(null)     // { date, scene }
  const [loadingDate, setLoadingDate] = useState(null)
  const [askDelete, setAskDelete] = useState(null)   // дата снимка, который просят удалить
  // Удаляет только репетитор: доски занятий — его летопись, и ученику не за чем
  // стирать разобранное. У ученика и RPC такого нет, поэтому кнопки просто нет.
  const canDelete = !(account && token)

  useEffect(() => {
    if (!studentId) return
    let alive = true
    const query = account && token
      ? supabase.rpc("board_snapshot_list", { p_account: account, p_token: token, p_student_id: String(studentId) })
      : supabase.from("board_snapshots")
        .select("lesson_date, preview")
        .eq("student_id", String(studentId))
        .order("lesson_date", { ascending: false })
        .limit(24)
    // Таблицы может не быть (миграция board_snapshots.sql не выполнена) — тогда блока просто нет.
    query.then(({ data }) => { if (alive && data) setRows(data) })
    return () => { alive = false }
  }, [studentId, account, token])

  async function openDate(date) {
    setLoadingDate(date)
    try {
      let scene = null
      if (account && token) {
        const { data } = await supabase.rpc("board_snapshot_get", {
          p_account: account, p_token: token, p_student_id: String(studentId), p_date: date,
        })
        scene = data
      } else {
        const { data } = await supabase.from("board_snapshots")
          .select("scene").eq("student_id", String(studentId)).eq("lesson_date", date).maybeSingle()
        scene = data?.scene
      }
      // Ссылки на картинки доска подписывает сама при загрузке сцены (бакет
      // приватный) — здесь снимок нужен как есть.
      if (scene) { setOpen({ date, scene }); refreshPreview(date, scene) }
    } finally {
      setLoadingDate(null)
    }
  }

  // Превью, снятые до 12.09.2026, вписывали в карточку ВСЮ сцену: на доске за
  // месяц занятий это узкая колонка листов в пол-пикселя, по которой занятие не
  // узнать. Сам снимок чинится только новым закрытием доски, а прошлые дни уже
  // никто не закроет — поэтому пересобираем превью при открытии занятия.
  // Право записи есть у репетитора; ученик обновлять не может (и не должен),
  // но увидит исправленную карточку, как только занятие откроет репетитор.
  // Ошибку глотаем: это украшение списка, а не работа.
  async function refreshPreview(date, scene) {
    if (!canDelete) return
    try {
      const [{ scenePreview }, { signBoardScene }] = await Promise.all([
        import("./boardPaint"), import("../storageUrl"),
      ])
      const preview = await scenePreview(await signBoardScene(scene))
      if (!preview) return
      const { error } = await supabase.from("board_snapshots")
        .update({ preview }).eq("student_id", String(studentId)).eq("lesson_date", date)
      if (error) return
      setRows((rs) => rs.map((r) => (r.lesson_date === date ? { ...r, preview } : r)))
    } catch { /* карточка останется с прежним превью */ }
  }

  // Снимок за сегодня — это ЖИВАЯ доска: запись за день мы убираем, но холст
  // не трогаем, иначе кнопка «удалить занятие из истории» стирала бы то, что
  // сейчас на экране у ученика. Закроют доску снова — снимок появится заново.
  async function removeDate(date) {
    setAskDelete(null)
    const { error } = await supabase.from("board_snapshots")
      .delete().eq("student_id", String(studentId)).eq("lesson_date", date)
    if (error) return
    setRows((rs) => rs.filter((r) => r.lesson_date !== date))
    setOpen((o) => (o && o.date === date ? null : o))
  }

  if (!rows.length) return null

  // Список приходит от новых к старым (и таблицей, и RPC), поэтому живая доска —
  // это первая карточка.
  const liveDate = rows[0]?.lesson_date || null

  return (
    <div className="glass p-4">
      <h2 className="text-sm font-medium mb-3">Доски занятий</h2>
      {/* Доски едут лентой вбок: занятий за год набирается много, и сеткой они
          вытеснили бы со страницы всё остальное. Карточка фиксированной ширины,
          скролл липнет к началу карточки. */}
      <div className="no-scrollbar overflow-x-auto snap-x snap-mandatory -mx-4 px-4">
        <div className="flex gap-3 w-max">
          {rows.map((r) => (
            // Кнопка удаления не может лежать ВНУТРИ карточки-кнопки (вложенные
            // button), поэтому карточка и крестик — соседи в общей обёртке.
            <div key={r.lesson_date} className="relative snap-start w-[46vw] max-w-[210px] sm:w-[210px]">
              <button
                onClick={() => (onOpenBoard && r.lesson_date === liveDate ? onOpenBoard() : openDate(r.lesson_date))}
                title={onOpenBoard && r.lesson_date === liveDate ? "Открыть доску" : "Посмотреть снимок"}
                className="press-fill glass-sm rounded-2xl overflow-hidden text-left w-full block p-1.5">
                {/* Снимок не прижимается к краям карточки: вокруг него поле,
                    иначе чёрное полотно доски читается как обрез карточки. */}
                <div className="aspect-[16/10] rounded-xl bg-white dark:bg-white/5 flex items-center justify-center overflow-hidden">
                  {r.preview
                    ? <img src={r.preview} alt="" className="w-full h-full object-cover" />
                    : <Icon name="clipboard" size={20} className="text-gray-400" />}
                </div>
                {/* Справа только ожидание: число штрихов сцены пользователю
                    ничего не говорит, а читалось как сумма или оценка. */}
                <div className="px-1.5 pt-2 pb-1 flex items-center justify-between gap-2 min-h-[30px]">
                  <span className="text-xs font-medium truncate">{humanDate(r.lesson_date)}</span>
                  {loadingDate === r.lesson_date && (
                    <span className="loader-dots text-gray-400"><i /><i /><i /></span>
                  )}
                </div>
              </button>
              {canDelete && (
                // Видна всегда, а не по наведению: на телефоне hover нет, а прятать
                // единственный способ убрать доску за долгое нажатие нельзя.
                // position — стилем: .press-tap в index.css ставит relative и
                // перебивает утилиту absolute, кнопка уезжала под карточку.
                <button onClick={() => setAskDelete(r.lesson_date)} title="Удалить доску"
                  aria-label={`Удалить доску за ${humanDate(r.lesson_date)}`}
                  style={{ position: "absolute" }}
                  className="press-tap top-2.5 right-2.5 w-6 h-6 rounded-full flex items-center justify-center
                    bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur ring-1 ring-gray-200/70 dark:ring-white/10
                    text-gray-400 hover:text-red-500">
                  <Icon name="x" size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      {/* ДОСКА ИДЁТ ПОРТАЛОМ В body, и это не украшение. Сам блок истории —
          стеклянная карточка (.glass), а у неё backdrop-filter: такой предок
          становится точкой отсчёта для position: fixed, и доска, объявленная
          «во весь экран», рисовалась ВНУТРИ карточки — узкой полосой поверх
          расписания. Ровно это и выглядело как «прямоугольное окно» (жалоба
          12.09.2026); прежний просмотрщик снимков страдал тем же. Остальные
          полноэкранные слои сайта здесь же порталятся (см. ConfirmModal). */}
      {open && createPortal((
        <Suspense fallback={
          <div className="fixed inset-0 z-[100000] bg-white dark:bg-[#1c1c1e] flex items-center justify-center">
            <div className="loader-logo" />
          </div>
        }>
          {/* key по дате: открыли другое занятие — доска собирается заново, а не
              донашивает штрихи предыдущей (та же осторожность, что и со сменой
              комнаты у живой доски). */}
          <Board
            key={open.date}
            roomId={String(studentId)}
            label={humanDate(open.date)}
            userId={account ? `s:${account}` : "t:view"}
            userName={studentName || ""}
            snapshot={open.scene}
            snapshotDate={open.date}
            onOpenLive={onOpenBoard}
            onClose={() => setOpen(null)}
          />
        </Suspense>
      ), document.body)}
      <ConfirmModal
        open={!!askDelete}
        title="Удалить доску?"
        message={askDelete
          ? (askDelete === liveDate
            ? "Снимок исчезнет из истории. Сама доска останется — то, что на ней нарисовано, никуда не денется."
            : `Доска за ${humanDate(askDelete)} исчезнет у вас и у ученика. Восстановить её будет нельзя.`)
          : ""}
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        danger
        zIndex={100002}
        onConfirm={() => removeDate(askDelete)}
        onCancel={() => setAskDelete(null)}
      />
    </div>
  )
}

export default BoardHistory
