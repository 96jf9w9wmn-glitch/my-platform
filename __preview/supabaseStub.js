const DATA = {
  variants: [], student_accounts: [{ id: "acc-1", name: "Иван Петров" }],
  homework: [
    { id: "h1", student_id: 1, title: "Дроби и проценты", hw_type: "test", status: "done", grade: 4,
      test_score: 6, question_count: 10, created_at: "2026-08-20T09:00:00Z",
      correct_answers: ["2","6","2","3","6","1","4","4","3","1,5"],
      student_answers: ["3","","2","3","","1","","3","3","вообще 2 точки но в задании написано так что надо одну точку указать"],
      credited: [10] },
    { id: "h2", student_id: 1, title: "Линейные уравнения", hw_type: "test", status: "done", grade: 5,
      test_score: 5, question_count: 5, created_at: "2026-08-28T09:00:00Z",
      correct_answers: ["2","-3","1,5","0","8"], student_answers: ["2","-3","1,5","0","8"], credited: [] },
  ],
  task_attempts: [],
}
function builder(table) {
  const res = { data: DATA[table] || [], error: null }
  const chain = { select: () => chain, eq: () => chain, in: () => chain, limit: () => chain, order: () => chain,
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    then: (ok, err) => Promise.resolve(res).then(ok, err) }
  return chain
}
export const supabase = { from: builder, rpc: () => Promise.resolve({ data: null, error: null }),
  storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: null }) }) },
  auth: { getSession: () => Promise.resolve({ data: { session: null } }) } }
export default supabase
