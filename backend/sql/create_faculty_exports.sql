CREATE TABLE IF NOT EXISTS faculty_exports (
  id SERIAL PRIMARY KEY,
  faculty_id TEXT NOT NULL,
  uploaded_by_email TEXT,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  row_count INTEGER,
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faculty_exports_faculty_id ON faculty_exports (faculty_id);
CREATE INDEX IF NOT EXISTS idx_faculty_exports_created_at ON faculty_exports (created_at);
