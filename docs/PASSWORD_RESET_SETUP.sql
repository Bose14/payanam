-- Payanam Password Reset Schema
-- Run this in your Supabase SQL Editor

ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_expires_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_password_token);

