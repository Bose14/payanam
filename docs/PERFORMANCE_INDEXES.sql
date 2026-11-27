-- Indexes for the queries the app runs most. Safe to run more than once.
-- Applied to the production project on 2026-11-27.

-- "Which of my trips has a live ride?" is one query over all trips now.
create index if not exists idx_ride_sessions_active_trip on public.ride_sessions (trip_id) where status = 'active';

-- Rooms are looked up by trip on nearly every trip screen.
create index if not exists idx_rooms_trip_id on public.rooms (trip_id);

-- "Which trips am I a member of?"
create index if not exists idx_room_members_user_id on public.room_members (user_id);

-- Ride chat history, newest first.
create index if not exists idx_ride_messages_session_created on public.ride_messages (session_id, created_at desc);
