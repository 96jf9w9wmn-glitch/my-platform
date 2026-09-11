import { useEffect, useState } from "react"
import { supabase } from "./supabase"

// Попытки ученика читаются ОДИН раз на карточку и раздаются блокам: и карте
// заданий, и готовности нужен один и тот же список, а два одинаковых запроса к
// task_attempts на каждое раскрытие — это ровно та мелочь, из которой потом
// складывается «кабинет подвисает».
export function useAttempts(studentId) {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    if (!studentId) return
    let alive = true
    supabase
      .from("task_attempts")
      .select("exam_type, number, gen_key, is_correct, attempt_no")
      .eq("student_id", String(studentId))
      .limit(4000)
      // Таблицы может не быть (миграция task_attempts.sql) — тогда блоки
      // работают без процентов, а не исчезают.
      .then(({ data }) => { if (alive) setRows(data || []) })
    return () => { alive = false }
  }, [studentId])
  return rows
}
