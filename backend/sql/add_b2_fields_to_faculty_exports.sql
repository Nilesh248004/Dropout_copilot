ALTER TABLE faculty_exports
  ADD COLUMN IF NOT EXISTS content_preview TEXT,
  ADD COLUMN IF NOT EXISTS object_key TEXT,
  ADD COLUMN IF NOT EXISTS storage_provider TEXT;

ALTER TABLE faculty_exports
  ALTER COLUMN content DROP NOT NULL;
