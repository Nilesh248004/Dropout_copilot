CREATE TABLE IF NOT EXISTS student_alerts (
  id SERIAL PRIMARY KEY,
  faculty_id TEXT NOT NULL,
  student_id INTEGER NOT NULL,
  student_name TEXT,
  register_number TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_alerts_student_id ON student_alerts (student_id);
CREATE INDEX IF NOT EXISTS idx_student_alerts_register_number ON student_alerts (register_number);
CREATE INDEX IF NOT EXISTS idx_student_alerts_created_at ON student_alerts (created_at);
