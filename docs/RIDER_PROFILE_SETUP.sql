-- ============================================================
-- PAYANAM RIDER PROFILE & EMERGENCY DETAILS SCHEMA
-- Run this in your Supabase SQL Editor if creating table manually
-- ============================================================

CREATE TABLE IF NOT EXISTS rider_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blood_group VARCHAR(10),
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(50),
  emergency_contact_relation VARCHAR(100),
  allergies TEXT,
  medical_notes TEXT,
  bike_model VARCHAR(255),
  bike_reg_no VARCHAR(100),
  driving_license_no VARCHAR(100),
  riding_style VARCHAR(100) DEFAULT 'Adventure / Touring',
  phone VARCHAR(50),
  city VARCHAR(255),
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE rider_profiles ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated operations
DROP POLICY IF EXISTS "Allow all for authenticated users on rider_profiles" ON rider_profiles;
CREATE POLICY "Allow all for authenticated users on rider_profiles"
  ON rider_profiles FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

