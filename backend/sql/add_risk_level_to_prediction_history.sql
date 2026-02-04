ALTER TABLE prediction_history
ADD COLUMN IF NOT EXISTS risk_level TEXT;
