-- Convert counselling_requests.scheduled_at to time zone-aware type
-- Existing values are stored as UTC strings from frontend toISOString, so we
-- interpret them as UTC while converting.
ALTER TABLE counselling_requests
ALTER COLUMN scheduled_at
TYPE TIMESTAMPTZ
USING scheduled_at AT TIME ZONE 'UTC';
