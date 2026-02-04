export const normalizeFacultyId = (value) => String(value ?? "").trim().toLowerCase();

export const filterStudentsByFaculty = (students, facultyId) => {
  if (!Array.isArray(students)) return [];
  const normalizedFaculty = normalizeFacultyId(facultyId);
  if (!normalizedFaculty) return [];
  return students.filter(
    (student) => normalizeFacultyId(student?.faculty_id) === normalizedFaculty
  );
};
