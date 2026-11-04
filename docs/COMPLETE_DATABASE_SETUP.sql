-- ============================================================
-- PAYANAM COMPLETE DATABASE SETUP SCRIPT
-- Paste and run this ENTIRE script in your Supabase SQL Editor
-- (https://supabase.com/dashboard -> SQL Editor -> New Query)
-- ============================================================

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  avatar_url VARCHAR(500),
  status VARCHAR(50) DEFAULT 'active',
  last_login_at TIMESTAMP,
  reset_password_token VARCHAR(255),
  reset_password_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. SESSIONS / REFRESH TOKENS TABLE
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token VARCHAR(500) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. TRIPS TABLE
CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  from_place VARCHAR(255) NOT NULL,
  to_place VARCHAR(255) NOT NULL,
  from_lat DECIMAL(10,7),
  from_lng DECIMAL(10,7),
  to_lat DECIMAL(10,7),
  to_lng DECIMAL(10,7),
  days INTEGER NOT NULL,
  bike_type VARCHAR(100) DEFAULT 'motorcycle',
  preferences TEXT,
  status VARCHAR(50) DEFAULT 'planning',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. ITINERARY ITEMS TABLE
CREATE TABLE IF NOT EXISTS itinerary_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  order_index INTEGER NOT NULL,
  place VARCHAR(255) NOT NULL,
  description TEXT,
  item_type VARCHAR(50) DEFAULT 'stop',
  estimated_km DECIMAL(8,2),
  duration_hours DECIMAL(4,2),
  tips TEXT,
  lat DECIMAL(9,6),
  lng DECIMAL(9,6),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 6. ROOMS (INVITE CODES) TABLE
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  invite_code VARCHAR(20) UNIQUE NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 7. ROOM MEMBERS TABLE
CREATE TABLE IF NOT EXISTS room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  role VARCHAR(20) DEFAULT 'member',
  status VARCHAR(20) DEFAULT 'pending',
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- 8. TRIP EXPENSES TABLE
CREATE TABLE IF NOT EXISTS trip_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  category VARCHAR(50) DEFAULT 'other',
  paid_by UUID NOT NULL REFERENCES users(id),
  split_type VARCHAR(20) DEFAULT 'equal',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 9. EXPENSE SPLITS TABLE
CREATE TABLE IF NOT EXISTS expense_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES trip_expenses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  amount NUMERIC(10,2) NOT NULL,
  is_settled BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 10. RIDE SESSIONS (LIVE CONVOY) TABLE
CREATE TABLE IF NOT EXISTS ride_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  started_by UUID NOT NULL REFERENCES users(id),
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'active'
);

-- 11. RIDER LOCATIONS (REAL-TIME TELEMETRY) TABLE
CREATE TABLE IF NOT EXISTS rider_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ride_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  user_name VARCHAR(255),
  lat DECIMAL(10,8) NOT NULL,
  lng DECIMAL(11,8) NOT NULL,
  speed_kmh DECIMAL(6,2) DEFAULT 0,
  heading DECIMAL(5,2) DEFAULT 0,
  quick_status VARCHAR(50) DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, user_id)
);

-- 12. RIDE MESSAGES & SOS CHAT TABLE
CREATE TABLE IF NOT EXISTS ride_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ride_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  user_name VARCHAR(255),
  message TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'chat',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 13. INDEXES FOR HIGH-SPEED LOOKUPS
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_password_token);
CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);
CREATE INDEX IF NOT EXISTS idx_itinerary_trip_id ON itinerary_items(trip_id);
CREATE INDEX IF NOT EXISTS idx_rooms_invite_code ON rooms(invite_code);
CREATE INDEX IF NOT EXISTS idx_trip_expenses_trip_id ON trip_expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense_id ON expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_ride_sessions_trip ON ride_sessions(trip_id);

-- 14. PERMISSIONS: DISABLE RLS ACROSS ALL TABLES
-- This allows your API backend (using JWT tokens & custom auth) full access
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE trips DISABLE ROW LEVEL SECURITY;
ALTER TABLE itinerary_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE room_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE trip_expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE expense_splits DISABLE ROW LEVEL SECURITY;
ALTER TABLE ride_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE rider_locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE ride_messages DISABLE ROW LEVEL SECURITY;

