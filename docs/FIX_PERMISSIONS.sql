-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard)
-- This allows your backend to create users, trips, rooms, rides, and expenses without RLS blocks.

ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;

-- If you have created the trips and ride tables, disable RLS on them too:
ALTER TABLE IF EXISTS trips DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS itinerary_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS room_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS trip_expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expense_splits DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ride_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS rider_locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ride_messages DISABLE ROW LEVEL SECURITY;

-- Ensure password reset columns exist:
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_expires_at TIMESTAMP;

