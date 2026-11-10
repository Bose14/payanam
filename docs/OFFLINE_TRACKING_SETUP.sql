-- ========================================================
-- FEATURE B: Offline Position Queue & Rider Trails Setup
-- ========================================================

-- Table for storing individual GPS fixes with sequence numbers
-- Supports deduplication across replays (UNIQUE constraint on session_id, user_id, seq)
CREATE TABLE IF NOT EXISTS rider_position_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ride_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  user_name VARCHAR(255),
  lat DECIMAL(10,8) NOT NULL,
  lng DECIMAL(11,8) NOT NULL,
  speed_kmh DECIMAL(6,2) DEFAULT 0,
  heading DECIMAL(5,2) DEFAULT 0,
  seq BIGINT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, user_id, seq)
);

-- Index for fast trail queries ordered by sequence
CREATE INDEX IF NOT EXISTS idx_rider_pos_hist_session_seq
  ON rider_position_history(session_id, user_id, seq);

-- Index for ordering by timestamp
CREATE INDEX IF NOT EXISTS idx_rider_pos_hist_session_time
  ON rider_position_history(session_id, recorded_at);

-- Disable Row Level Security for seamless convoy telemetry access
ALTER TABLE IF EXISTS rider_position_history DISABLE ROW LEVEL SECURITY;

