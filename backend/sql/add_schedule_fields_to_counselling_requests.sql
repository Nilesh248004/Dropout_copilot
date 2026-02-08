ALTER TABLE counselling_requests
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

ALTER TABLE counselling_requests
ADD COLUMN IF NOT EXISTS meet_link TEXT;
