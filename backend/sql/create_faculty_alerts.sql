CREATE TABLE IF NOT EXISTS faculty_alerts (
  id SERIAL PRIMARY KEY,
  faculty_id TEXT NOT NULL,
  student_id INTEGER,
  student_name TEXT,
  register_number TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faculty_alerts_faculty_id ON faculty_alerts (faculty_id);
CREATE INDEX IF NOT EXISTS idx_faculty_alerts_created_at ON faculty_alerts (created_at);
