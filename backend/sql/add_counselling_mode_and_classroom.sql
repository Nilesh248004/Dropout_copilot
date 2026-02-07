ALTER TABLE counselling_requests
ADD COLUMN IF NOT EXISTS counselling_mode TEXT;

ALTER TABLE counselling_requests
ADD COLUMN IF NOT EXISTS classroom TEXT;
