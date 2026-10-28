import { getDatabase } from '../config/database';
import { generateItinerary } from './ai.service';

async function geocodePlace(name: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=1&countrycodes=in`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'Payanam-App' } }
    );
    const data = await res.json() as Array<{ lat: string; lon: string }>;
    if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch { /* silent */ }
  return null;
}

interface CreateTripData {
  title: string;
  from_place: string;
  to_place: string;
  from_lat?: number | null;
  from_lng?: number | null;
  to_lat?: number | null;
  to_lng?: number | null;
  days: number;
  bike_type: string;
  trip_type?: string;
  preferences?: string;
}

function randomCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function createTrip(userId: string, data: CreateTripData) {
  const db = getDatabase();
  const title = data.title || `${data.from_place} to ${data.to_place}`;

  // Explicitly list columns — trip_type is only used for AI generation, never stored
  const row: Record<string, unknown> = {
    title,
    user_id: userId,
    from_place: data.from_place,
    to_place: data.to_place,
    days: data.days,
    bike_type: data.bike_type,
    preferences: data.preferences ?? null,
  };
  if (data.from_lat != null) row.from_lat = data.from_lat;
  if (data.from_lng != null) row.from_lng = data.from_lng;
  if (data.to_lat != null) row.to_lat = data.to_lat;
  if (data.to_lng != null) row.to_lng = data.to_lng;

  const { data: trip, error } = await db.from('trips').insert(row).select().single();
  if (error) throw new Error(error.message);
  return trip;
}

export async function getUserTrips(userId: string) {
  const db = getDatabase();

  // Trips the user owns
  const { data: ownedTrips, error } = await db
    .from('trips')
    .select('*, rooms(id, invite_code)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  // Step 1: get room_ids where user is an approved member (not owner)
  const { data: memberships } = await db
    .from('room_members')
    .select('room_id')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .neq('role', 'owner');

  const joinedTrips: unknown[] = [];

  if (memberships && memberships.length > 0) {
    const roomIds = memberships.map((m) => m.room_id);

    // Step 2: get rooms to find trip_ids
    const { data: rooms } = await db
      .from('rooms')
      .select('id, invite_code, trip_id')
      .in('id', roomIds);

    if (rooms && rooms.length > 0) {
      const tripIds = rooms.map((r) => r.trip_id);

      // Step 3: get the actual trips
      const { data: tripData } = await db
        .from('trips')
        .select('*')
        .in('id', tripIds);

      (tripData ?? []).forEach((t) => {
        const room = rooms.find((r) => r.trip_id === t.id);
        joinedTrips.push({
          ...t,
          rooms: room ? [{ id: room.id, invite_code: room.invite_code }] : [],
          isOwner: false,
          isJoined: true,
        });
      });
    }
  }

  console.log(`[getUserTrips] userId=${userId} owned=${ownedTrips?.length ?? 0} joined=${joinedTrips.length}`);
  return [
    ...(ownedTrips ?? []).map((t) => ({ ...t, isOwner: true })),
    ...joinedTrips,
  ];
}

export async function getTripById(tripId: string, userId: string) {
  const db = getDatabase();

  // Try as owner first
  const { data: ownerTrip } = await db
    .from('trips')
    .select('*, rooms(id, invite_code)')
    .eq('id', tripId)
    .eq('user_id', userId)
    .maybeSingle();

  if (ownerTrip) {
    const { data: items } = await db.from('itinerary_items').select('*').eq('trip_id', tripId).order('day_number').order('order_index');
    return { ...ownerTrip, itinerary: items ?? [], isOwner: true };
  }

  // Try as approved room member
  const { data: room } = await db.from('rooms').select('id').eq('trip_id', tripId).maybeSingle();
  if (!room) throw new Error('Trip not found');

  const { data: membership } = await db.from('room_members').select('status').eq('room_id', room.id).eq('user_id', userId).maybeSingle();

  if (!membership) throw new Error('Trip not found');
  if (membership.status === 'pending') throw new Error('PENDING');
  if (membership.status === 'rejected') throw new Error('REJECTED');

  const { data: trip, error } = await db.from('trips').select('*, rooms(id, invite_code)').eq('id', tripId).single();
  if (error || !trip) throw new Error('Trip not found');

  const { data: items } = await db.from('itinerary_items').select('*').eq('trip_id', tripId).order('day_number').order('order_index');
  return { ...trip, itinerary: items ?? [], isOwner: false };
}

export async function saveItinerary(
  tripId: string,
  itineraryDays: Awaited<ReturnType<typeof generateItinerary>>,
  tripEnds?: {
    from_place: string; from_lat?: number | null; from_lng?: number | null;
    to_place: string; to_lat?: number | null; to_lng?: number | null;
  }
) {
  const db = getDatabase();

  // Resolve start/end coords: use stored GPS coords, else geocode the place name
  let startCoords: { lat: number; lng: number } | null = null;
  let endCoords: { lat: number; lng: number } | null = null;
  if (tripEnds) {
    startCoords = (tripEnds.from_lat && tripEnds.from_lng)
      ? { lat: tripEnds.from_lat, lng: tripEnds.from_lng }
      : await geocodePlace(tripEnds.from_place);
    endCoords = (tripEnds.to_lat && tripEnds.to_lng)
      ? { lat: tripEnds.to_lat, lng: tripEnds.to_lng }
      : await geocodePlace(tripEnds.to_place);
  }

  const lastDay = Math.max(...itineraryDays.map((d) => d.day), 1);
  const lastDayMaxOrder = Math.max(
    ...(itineraryDays.find((d) => d.day === lastDay)?.stops.map((s) => s.order) ?? [0])
  );

  const midRows = itineraryDays.flatMap((day) =>
    day.stops.map((stop) => ({
      trip_id: tripId,
      day_number: day.day,
      // Shift day-1 order_index by 1 to make room for the start point at index 0
      order_index: day.day === 1 && startCoords ? stop.order + 1 : stop.order,
      place: stop.place,
      description: stop.description,
      item_type: stop.type,
      estimated_km: stop.estimatedKm,
      duration_hours: stop.durationHours,
      tips: stop.tips,
      lat: stop.lat ?? null,
      lng: stop.lng ?? null,
    })),
  );

  const startRow = startCoords && tripEnds ? [{
    trip_id: tripId, day_number: 1, order_index: 0,
    place: tripEnds.from_place, item_type: 'stop', lat: startCoords.lat, lng: startCoords.lng,
    description: 'Starting point', tips: '',
  }] : [];

  const endRow = endCoords && tripEnds ? [{
    trip_id: tripId, day_number: lastDay, order_index: lastDayMaxOrder + 2,
    place: tripEnds.to_place, item_type: 'stop', lat: endCoords.lat, lng: endCoords.lng,
    description: 'Destination', tips: '',
  }] : [];

  const rows = [...startRow, ...midRows, ...endRow];
  const { error } = await db.from('itinerary_items').insert(rows);
  if (error) throw new Error(error.message);
}

export async function createRoom(tripId: string, userId: string) {
  const db = getDatabase();

  let invite_code = randomCode();
  let attempts = 0;
  while (attempts < 5) {
    const { data: existing } = await db.from('rooms').select('id').eq('invite_code', invite_code).maybeSingle();
    if (!existing) break;
    invite_code = randomCode();
    attempts++;
  }

  const { data: room, error } = await db
    .from('rooms')
    .insert({ trip_id: tripId, invite_code, created_by: userId })
    .select()
    .single();

  if (error) throw new Error(error.message);

  await db.from('room_members').insert({ room_id: room.id, user_id: userId, role: 'owner', status: 'approved' });

  return room;
}

export async function joinRoom(inviteCode: string, userId: string) {
  const db = getDatabase();
  const { data: room, error } = await db
    .from('rooms')
    .select('*, trips(id, title, from_place, to_place, days)')
    .eq('invite_code', inviteCode.toUpperCase())
    .single();

  if (error || !room) throw new Error('Room not found');

  const { data: existing } = await db
    .from('room_members')
    .select('id, status, role')
    .eq('room_id', room.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    return { room, memberStatus: existing.status ?? 'approved', isNew: false };
  }

  await db.from('room_members').insert({ room_id: room.id, user_id: userId, role: 'member', status: 'pending' });
  return { room, memberStatus: 'pending', isNew: true };
}

export async function getRoomPreview(inviteCode: string) {
  const db = getDatabase();
  const { data: room, error } = await db
    .from('rooms')
    .select('id, invite_code, trips(id, title, from_place, to_place, days, bike_type)')
    .eq('invite_code', inviteCode.toUpperCase())
    .single();

  if (error || !room) throw new Error('Room not found');
  return room;
}

export async function getApprovedMembers(tripId: string, ownerId: string) {
  const db = getDatabase();
  const { data: trip } = await db.from('trips').select('id').eq('id', tripId).eq('user_id', ownerId).maybeSingle();
  if (!trip) throw new Error('Not authorized');

  const { data: room } = await db.from('rooms').select('id').eq('trip_id', tripId).single();
  if (!room) return [];

  const { data: members, error } = await db
    .from('room_members')
    .select('id, user_id, role, status, joined_at, users(full_name, email)')
    .eq('room_id', room.id)
    .eq('status', 'approved')
    .neq('role', 'owner');

  if (error) throw new Error(error.message);
  return members ?? [];
}

export async function getPendingRequests(tripId: string, ownerId: string) {
  const db = getDatabase();

  const { data: trip } = await db.from('trips').select('id').eq('id', tripId).eq('user_id', ownerId).maybeSingle();
  if (!trip) throw new Error('Not authorized');

  const { data: room } = await db.from('rooms').select('id').eq('trip_id', tripId).single();
  if (!room) throw new Error('Room not found');

  const { data: members, error } = await db
    .from('room_members')
    .select('id, user_id, role, status, joined_at, users(full_name, email)')
    .eq('room_id', room.id)
    .eq('status', 'pending');

  if (error) throw new Error(error.message);
  return members ?? [];
}

export async function respondToRequest(roomMemberId: string, action: 'approved' | 'rejected', ownerId: string) {
  const db = getDatabase();

  const { data: member } = await db
    .from('room_members')
    .select('id, rooms(trip_id)')
    .eq('id', roomMemberId)
    .single();

  if (!member) throw new Error('Request not found');

  const tripId = (member.rooms as unknown as { trip_id: string } | null)?.trip_id;
  if (!tripId) throw new Error('Request not found');

  const { data: trip } = await db.from('trips').select('id').eq('id', tripId).eq('user_id', ownerId).maybeSingle();
  if (!trip) throw new Error('Not authorized');

  const { error } = await db.from('room_members').update({ status: action }).eq('id', roomMemberId);
  if (error) throw new Error(error.message);
}

export async function updateItinerary(tripId: string, userId: string, stops: Array<{
  id?: string; day_number: number; order_index: number; place: string; description?: string;
  item_type?: string; estimated_km?: number; duration_hours?: number; tips?: string;
  lat?: number; lng?: number;
}>) {
  const db = getDatabase();
  const { data: trip } = await db.from('trips').select('id').eq('id', tripId).eq('user_id', userId).single();
  if (!trip) throw new Error('Trip not found');
  await db.from('itinerary_items').delete().eq('trip_id', tripId);
  if (stops.length > 0) {
    const { error } = await db.from('itinerary_items').insert(
      stops.map(({ id: _id, ...s }) => ({ ...s, trip_id: tripId }))
    );
    if (error) throw new Error(error.message);
  }
}

export async function getAllTripParticipants(tripId: string, userId: string) {
  const db = getDatabase();

  const { data: trip } = await db.from('trips').select('id, user_id').eq('id', tripId).maybeSingle();
  if (!trip) throw new Error('Trip not found');

  if (trip.user_id !== userId) {
    const { data: roomCheck } = await db.from('rooms').select('id').eq('trip_id', tripId).maybeSingle();
    if (!roomCheck) throw new Error('Not authorized');
    const { data: memberCheck } = await db.from('room_members').select('status').eq('room_id', roomCheck.id).eq('user_id', userId).maybeSingle();
    if (!memberCheck || memberCheck.status !== 'approved') throw new Error('Not authorized');
  }

  const { data: owner } = await db.from('users').select('id, full_name, email').eq('id', trip.user_id).single();
  const { data: room } = await db.from('rooms').select('id').eq('trip_id', tripId).maybeSingle();
  const coRiders: Array<{ id: string; full_name: string; email: string }> = [];

  if (room) {
    const { data: members } = await db
      .from('room_members')
      .select('user_id, users(id, full_name, email)')
      .eq('room_id', room.id)
      .eq('status', 'approved')
      .neq('role', 'owner');

    (members ?? []).forEach((m: unknown) => {
      const member = m as { users: { id: string; full_name: string; email: string } | null };
      if (member.users) coRiders.push(member.users);
    });
  }

  return [
    { id: owner!.id, full_name: owner!.full_name ?? 'Lead Rider', email: owner!.email, role: 'owner' as const },
    ...coRiders.map(r => ({ ...r, role: 'member' as const })),
  ];
}

export async function deleteTrip(tripId: string, userId: string) {
  const db = getDatabase();
  const { error } = await db.from('trips').delete().eq('id', tripId).eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function getRoomByTripId(tripId: string) {
  const db = getDatabase();
  const { data, error } = await db.from('rooms').select('*').eq('trip_id', tripId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
