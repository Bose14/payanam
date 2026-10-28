-- Run this in Supabase SQL Editor
-- Drop existing tables first (in reverse dependency order)
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS room_members CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS itinerary_items CASCADE;
DROP TABLE IF EXISTS trips CASCADE;

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

CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  invite_code VARCHAR(20) UNIQUE NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  role VARCHAR(20) DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES users(id),
  category VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  description VARCHAR(255),
  expense_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);
CREATE INDEX IF NOT EXISTS idx_itinerary_trip_id ON itinerary_items(trip_id);
CREATE INDEX IF NOT EXISTS idx_rooms_invite_code ON rooms(invite_code);
CREATE INDEX IF NOT EXISTS idx_expenses_room_id ON expenses(room_id);

-- Run separately if tables already exist (lat/lng columns):
-- ALTER TABLE itinerary_items ADD COLUMN IF NOT EXISTS lat DECIMAL(9,6);
-- ALTER TABLE itinerary_items ADD COLUMN IF NOT EXISTS lng DECIMAL(9,6);

-- Run this to add exact start/end coordinates to existing trips table:
-- ALTER TABLE trips ADD COLUMN IF NOT EXISTS from_lat DECIMAL(10,7);
-- ALTER TABLE trips ADD COLUMN IF NOT EXISTS from_lng DECIMAL(10,7);
-- ALTER TABLE trips ADD COLUMN IF NOT EXISTS to_lat DECIMAL(10,7);
-- ALTER TABLE trips ADD COLUMN IF NOT EXISTS to_lng DECIMAL(10,7);
