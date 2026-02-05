CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  register_number TEXT UNIQUE NOT NULL,
  year INTEGER NOT NULL,
  semester INTEGER NOT NULL,
  faculty_id TEXT,
  phone_number TEXT
);