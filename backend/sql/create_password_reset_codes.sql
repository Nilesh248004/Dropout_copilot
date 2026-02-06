CREATE TABLE IF NOT EXISTS password_reset_codes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  used_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_reset_codes_user_id
  ON password_reset_codes(user_id);
