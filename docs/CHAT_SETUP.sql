-- ============================================================
-- PAYANAM CHAT: trip chat, group chat, direct messages
-- Run in the Supabase SQL editor. Safe to run more than once.
-- Tables are reachable only through the API (service role).
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  invite_code VARCHAR(12) UNIQUE NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  role VARCHAR(10) NOT NULL DEFAULT 'member',      -- 'admin' | 'member'
  status VARCHAR(10) NOT NULL DEFAULT 'pending',   -- 'member' | 'pending'
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_chat_group_members_user ON chat_group_members(user_id);

-- conversation_key is 'trip:<tripId>', 'group:<groupId>' or 'dm:<userIdA>:<userIdB>' (ids sorted).
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_key VARCHAR(120) NOT NULL,
  sender_id UUID NOT NULL REFERENCES users(id),
  kind VARCHAR(10) NOT NULL DEFAULT 'text',        -- 'text' | 'location'
  body TEXT NOT NULL,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON chat_messages(conversation_key, created_at DESC);

CREATE TABLE IF NOT EXISTS chat_reads (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_key VARCHAR(120) NOT NULL,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, conversation_key)
);

ALTER TABLE chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_reads ENABLE ROW LEVEL SECURITY;
