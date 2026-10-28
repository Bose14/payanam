import { getDatabase } from '../config/database';

export async function startRide(tripId: string, userId: string) {
  const db = getDatabase();
  const { data: trip } = await db.from('trips').select('id').eq('id', tripId).eq('user_id', userId).single();
  if (!trip) throw new Error('Not authorized');
  await db.from('ride_sessions')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('trip_id', tripId).eq('status', 'active');
  const { data, error } = await db.from('ride_sessions')
    .insert({ trip_id: tripId, started_by: userId, status: 'active' })
    .select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function endRide(sessionId: string, userId: string) {
  const db = getDatabase();
  const { data: session } = await db.from('ride_sessions').select('started_by').eq('id', sessionId).single();
  if (!session || session.started_by !== userId) throw new Error('Not authorized');
  await db.from('ride_sessions')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', sessionId);
}

export async function getActiveSession(tripId: string) {
  const db = getDatabase();
  const { data } = await db.from('ride_sessions')
    .select('*').eq('trip_id', tripId).eq('status', 'active').maybeSingle();
  return data;
}

export async function getSessionById(sessionId: string) {
  const db = getDatabase();
  const { data, error } = await db.from('ride_sessions')
    .select('*, trips(id, title, from_place, to_place, from_lat, from_lng, to_lat, to_lng, days)')
    .eq('id', sessionId).single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Session not found');

  const { data: items } = await db.from('itinerary_items')
    .select('id, place, lat, lng, day_number, order_index, item_type')
    .eq('trip_id', (data.trips as { id: string }).id)
    .order('day_number').order('order_index');

  return { ...data, itinerary: items ?? [] };
}

export async function updateLocation(
  sessionId: string, userId: string, userName: string,
  lat: number, lng: number, speedKmh: number, heading: number,
) {
  const db = getDatabase();
  const { error } = await db.from('rider_locations').upsert(
    { session_id: sessionId, user_id: userId, user_name: userName, lat, lng, speed_kmh: speedKmh, heading, updated_at: new Date().toISOString() },
    { onConflict: 'session_id,user_id' },
  );
  if (error) throw new Error(error.message);
}

export async function updateQuickStatus(sessionId: string, userId: string, quickStatus: string) {
  const db = getDatabase();
  await db.from('rider_locations')
    .update({ quick_status: quickStatus, updated_at: new Date().toISOString() })
    .eq('session_id', sessionId).eq('user_id', userId);
}

export async function getAllLocations(sessionId: string) {
  const db = getDatabase();
  const { data } = await db.from('rider_locations')
    .select('*').eq('session_id', sessionId)
    .gte('updated_at', new Date(Date.now() - 30000).toISOString());
  return data ?? [];
}

export async function sendMessage(
  sessionId: string, userId: string, userName: string,
  message: string, messageType: string = 'chat',
) {
  const db = getDatabase();
  const { data, error } = await db.from('ride_messages')
    .insert({ session_id: sessionId, user_id: userId, user_name: userName, message, message_type: messageType })
    .select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getMessages(sessionId: string, since?: string) {
  const db = getDatabase();
  let query = db.from('ride_messages')
    .select('*').eq('session_id', sessionId).order('created_at');
  if (since) query = query.gt('created_at', since);
  const { data } = await query;
  return data ?? [];
}
