ALTER TABLE students
ADD COLUMN IF NOT EXISTS phone_number TEXT;

ALTER TABLE academic_records
ADD COLUMN IF NOT EXISTS disciplinary_issues INTEGER;
