ALTER TABLE counselling_requests
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP;

ALTER TABLE counselling_requests
ADD COLUMN IF NOT EXISTS meet_link TEXT;
