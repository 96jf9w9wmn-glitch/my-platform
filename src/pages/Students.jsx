import { useState } from "react"
import AddStudentModal from "../components/AddStudentModal"
import StudentProfile from "./StudentProfile"

function Students({ students, setStudents }) {
  const [showModal, setShowModal] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState(null)

  function handleAdd(newStudent) {
    setStudents((prev) => [...prev, newStudent])
  }

  if (selectedStudent) {
    const student = students.find((s) => s.id === selectedStudent)
    return (
      <StudentProfile
        student={student}
        onBack={() => setSelectedStudent(null)}
        onUpdate={(id, data) => setStudents((prev) => prev.map((s) => s.id === id ? { ...s, ...data } : s))}
      />
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-medium">Ученики</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
        >
          + Добавить ученика
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-100 rounded-lg p-4">
          <div className="text-sm text-gray-500 mb-1">Всего учеников</div>
          <div className="text-2xl font-medium">{students.length}</div>
        </div>
        <div className="bg-gray-100 rounded-lg p-4">
          <div className="text-sm text-gray-500 mb-1">Оплачено</div>
          <div className="text-2xl font-medium">{students.filter((s) => s.paid).length}</div>
        </div>
        <div className="bg-gray-100 rounded-lg p-4">
          <div className="text-sm text-gray-500 mb-1">Долг по оплате</div>
          <div className="text-2xl font-medium text-amber-600">{students.filter((s) => !s.paid).length}</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-4 gap-4 px-4 py-3 bg-gray-50 text-xs text-gray-500 font-medium">
          <span>Ученик</span>
          <span>Расписание</span>
          <span>Оплата</span>
          <span>Средний балл</span>
        </div>
        {students.map((student) => (
          <div
            key={student.id}
            onClick={() => setSelectedStudent(student.id)}
            className="grid grid-cols-4 gap-4 px-4 py-3 border-t border-gray-100 items-center cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <div>
              <div className="font-medium text-sm">{student.name}</div>
              <div className="text-xs text-gray-500">{student.phone}</div>
            </div>
            <div className="text-sm text-gray-600 truncate">{student.schedule}</div>
            <div>
              {student.paid ? (
                <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">Оплачено</span>
              ) : (
                <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full">Долг</span>
              )}
            </div>
            <div className="text-sm font-medium">
              {student.results?.length > 0
                ? Math.round(student.results.reduce((a, b) => a + b, 0) / student.results.length)
                : "—"}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <AddStudentModal
          onClose={() => setShowModal(false)}
          onAdd={handleAdd}
        />
      )}
    </div>
  )
}

export default Students
