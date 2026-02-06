CREATE TABLE IF NOT EXISTS app_users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'faculty', 'admin')),
  password_hash TEXT,
  auth_provider TEXT NOT NULL DEFAULT 'local',
  faculty_id TEXT,
  student_id TEXT,
  phone_number TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT app_users_role_id_check CHECK (
    (role = 'faculty' AND student_id IS NULL)
    OR (role = 'student' AND student_id IS NOT NULL AND faculty_id IS NULL)
    OR (role = 'admin' AND faculty_id IS NULL AND student_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users (email);
CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_lower_key ON app_users (LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS app_users_faculty_id_lower_key ON app_users (LOWER(faculty_id)) WHERE faculty_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS app_users_student_id_lower_key ON app_users (LOWER(student_id)) WHERE student_id IS NOT NULL;
