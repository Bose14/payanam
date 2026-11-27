import { getDatabase } from '../config/database';
import { ForbiddenError } from '../utils/errors';
import { getTripMemberIds } from './trip.service';
import { sendPush } from './push.service';

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
  // Captain-only broadcasts: pinning the convoy target stop and announcements.
  if (messageType === 'stop_pin' || messageType === 'announcement') {
    const { data: session } = await db.from('ride_sessions').select('started_by').eq('id', sessionId).single();
    if (!session || session.started_by !== userId) throw new ForbiddenError('Only the captain can do this');
  }
  const { data, error } = await db.from('ride_messages')
    .insert({ session_id: sessionId, user_id: userId, user_name: userName, message, message_type: messageType })
    .select().single();
  if (error) throw new Error(error.message);
  void notifyRide(sessionId, userId, userName, message, messageType);
  return data;
}

const RIDE_PUSH_TITLES: Record<string, string> = {
  sos: 'SOS from a rider',
  announcement: 'Captain announcement',
  stop_pin: 'Next stop set',
};

/** Urgent ride events reach riders even when the app is closed. */
async function notifyRide(sessionId: string, senderId: string, senderName: string, message: string, type: string) {
  const title = RIDE_PUSH_TITLES[type];
  if (!title) return;
  try {
    const { data: session } = await getDatabase().from('ride_sessions').select('trip_id').eq('id', sessionId).single();
    if (!session) return;
    const members = (await getTripMemberIds(session.trip_id as string)).filter((id) => id !== senderId);
    await sendPush(members, {
      title: type === 'sos' ? `SOS: ${senderName}` : title,
      body: message.slice(0, 140),
      url: `/ride/${sessionId}`,
      tag: `ride:${sessionId}:${type}`,
      urgent: type === 'sos',
    });
  } catch { /* ignore */ }
}

export async function getMessages(sessionId: string, since?: string) {
  const db = getDatabase();
  let query = db.from('ride_messages')
    .select('*').eq('session_id', sessionId).order('created_at');
  if (since) query = query.gt('created_at', since);
  const { data } = await query;
  return data ?? [];
}

const MISSING_AFTER_MS = 5 * 60 * 1000;
const alerted = new Map<string, number>(); // `${sessionId}:${userId}` -> time alerted

/**
 * Looks for riders on an active ride whose last position is older than five minutes and tells the captain once.
 * Alerts again only after the rider has reported in and gone quiet a second time.
 */
export async function checkMissingRiders() {
  const db = getDatabase();
  const { data: sessions } = await db.from('ride_sessions').select('id, trip_id, started_by').eq('status', 'active');
  const now = Date.now();
  if (!sessions?.length) return;
  const { data: allLocs } = await db.from('rider_locations')
    .select('session_id, user_id, user_name, updated_at').in('session_id', sessions.map((x) => x.id));
  const locsBySession = new Map<string, NonNullable<typeof allLocs>>();
  for (const l of allLocs ?? []) {
    const list = locsBySession.get(l.session_id as string) ?? [];
    list.push(l);
    locsBySession.set(l.session_id as string, list);
  }
  for (const s of sessions) {
    const locs = locsBySession.get(s.id as string) ?? [];
    const lines: string[] = [];
    for (const l of locs) {
      if (l.user_id === s.started_by) continue;
      const k = `${s.id}:${l.user_id}`;
      const age = now - new Date(l.updated_at as string).getTime();
      if (age >= MISSING_AFTER_MS) {
        if (!alerted.has(k)) { alerted.set(k, now); lines.push((l.user_name as string) || 'A rider'); }
      } else {
        alerted.delete(k);
      }
    }
    if (lines.length > 0) {
      await sendPush([s.started_by as string], {
        title: lines.length === 1 ? `${lines[0]} may be missing` : `${lines.length} riders may be missing`,
        body: `${lines.join(', ')} ${lines.length === 1 ? 'has' : 'have'} not shared a position for 5 minutes.`,
        url: `/ride/${s.id}`,
        tag: `missing:${s.id}`,
        urgent: true,
      });
    }
  }
}
