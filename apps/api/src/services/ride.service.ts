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

  // Step 1: get the session row
  const { data: session, error } = await db.from('ride_sessions')
    .select('*').eq('id', sessionId).single();
  if (error) throw new Error(error.message);
  if (!session) throw new Error('Session not found');

  // Step 2: get the trip (explicit query — FK joins unreliable in PostgREST)
  const { data: trip } = await db.from('trips')
    .select('id, title, from_place, to_place, from_lat, from_lng, to_lat, to_lng, days')
    .eq('id', session.trip_id).single();

  // Step 3: get itinerary items (including description for 'from chat' detection)
  const { data: items } = await db.from('itinerary_items')
    .select('id, place, lat, lng, day_number, order_index, item_type, description')
    .eq('trip_id', session.trip_id)
    .order('day_number').order('order_index');

  return { ...session, trips: trip ?? null, itinerary: items ?? [] };
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
    .order('updated_at', { ascending: false });
  return data ?? [];
}

export interface PositionFixItem {
  lat: number;
  lng: number;
  speedKmh?: number;
  heading?: number;
  userName?: string;
  seq: number;
  timestamp: string;
}

export async function updateLocationBatch(
  sessionId: string,
  userId: string,
  userName: string,
  fixes: PositionFixItem[],
) {
  if (!fixes || fixes.length === 0) {
    return { acceptedCount: 0, latestLocation: null };
  }

  const db = getDatabase();

  // Deduplicate fixes by seq within the batch
  const uniqueMap = new Map<number, PositionFixItem>();
  for (const f of fixes) {
    if (f.lat != null && f.lng != null && f.seq != null) {
      uniqueMap.set(f.seq, f);
    }
  }
  const uniqueFixes = Array.from(uniqueMap.values()).sort((a, b) => a.seq - b.seq);

  if (uniqueFixes.length === 0) {
    return { acceptedCount: 0, latestLocation: null };
  }

  // 1. Attempt writing to rider_position_history for trails and duplicate elimination across replays
  try {
    const historyRows = uniqueFixes.map((f) => ({
      session_id: sessionId,
      user_id: userId,
      user_name: f.userName || userName,
      lat: f.lat,
      lng: f.lng,
      speed_kmh: f.speedKmh ?? 0,
      heading: f.heading ?? 0,
      seq: f.seq,
      recorded_at: f.timestamp || new Date().toISOString(),
    }));

    await db.from('rider_position_history').upsert(historyRows, {
      onConflict: 'session_id,user_id,seq',
      ignoreDuplicates: true,
    });
  } catch (err) {
    // If table not yet created in remote DB, log and gracefully continue
    console.warn('rider_position_history upsert skipped:', err);
  }

  // 2. Identify the most recent fix
  const latestFix = uniqueFixes[uniqueFixes.length - 1];

  // 3. Upsert into rider_locations with latest accepted position
  const { error: locError } = await db.from('rider_locations').upsert(
    {
      session_id: sessionId,
      user_id: userId,
      user_name: latestFix.userName || userName,
      lat: latestFix.lat,
      lng: latestFix.lng,
      speed_kmh: latestFix.speedKmh ?? 0,
      heading: latestFix.heading ?? 0,
      updated_at: latestFix.timestamp || new Date().toISOString(),
    },
    { onConflict: 'session_id,user_id' },
  );

  if (locError) {
    console.warn('rider_locations batch upsert warning:', locError.message);
  }

  return {
    acceptedCount: uniqueFixes.length,
    latestLocation: {
      user_id: userId,
      user_name: latestFix.userName || userName,
      lat: latestFix.lat,
      lng: latestFix.lng,
      speed_kmh: latestFix.speedKmh ?? 0,
      heading: latestFix.heading ?? 0,
      updated_at: latestFix.timestamp || new Date().toISOString(),
    },
  };
}

export async function getRiderTrails(sessionId: string) {
  const db = getDatabase();
  try {
    const { data, error } = await db
      .from('rider_position_history')
      .select('user_id, lat, lng, recorded_at, seq')
      .eq('session_id', sessionId)
      .order('seq', { ascending: true })
      .limit(2000);

    if (error || !data) return {};

    const trails: Record<string, Array<[number, number]>> = {};
    for (const pt of data) {
      if (!trails[pt.user_id]) trails[pt.user_id] = [];
      trails[pt.user_id].push([Number(pt.lat), Number(pt.lng)]);
    }
    return trails;
  } catch {
    return {};
  }
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
