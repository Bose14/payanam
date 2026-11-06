import { getDatabase } from '../config/database';
import { generateItinerary } from './ai.service';
import { readLocalProfiles } from './profile.service';
import {
  writeLocalRequest,
  readLocalRequests,
  getLocalRequestByRoomAndUser,
  getLocalRequestByTripAndUser,
  getLocalRequestsForRoom,
  getLocalRequestsForTrip,
  getLocalApprovedTripsForUser,
  updateLocalRequestStatus,
  LocalRoomRequest,
} from './roomRequest.service';

async function geocodePlace(name: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=1&countrycodes=in`,
      {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'Payanam-App/1.0' },
        signal: AbortSignal.timeout(3500),
      }
    );
    if (!res.ok) return null;
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
    days: Number(data.days) || 1,
    bike_type: data.bike_type || 'motorcycle',
  };
  if (data.preferences) row.preferences = data.preferences;
  if (data.from_lat != null) row.from_lat = data.from_lat;
  if (data.from_lng != null) row.from_lng = data.from_lng;
  if (data.to_lat != null) row.to_lat = data.to_lat;
  if (data.to_lng != null) row.to_lng = data.to_lng;

  const insertRes = await db.from('trips').insert(row).select().single();
  if (insertRes.error) {
    console.warn('[createTrip] Insert with extended columns failed, falling back to base columns:', insertRes.error.message);
    const baseRow = {
      title,
      user_id: userId,
      from_place: data.from_place,
      to_place: data.to_place,
      days: Number(data.days) || 1,
      bike_type: data.bike_type || 'motorcycle',
    };
    const retry = await db.from('trips').insert(baseRow).select().single();
    if (retry.error) throw new Error(retry.error.message);
    return retry.data;
  }
  return insertRes.data;
}

export async function assertUserTripMembership(
  tripId: string,
  userId: string
): Promise<{ isOwner: boolean; status: 'approved' | 'pending' | 'rejected' | 'none' }> {
  const db = getDatabase();

  // 1. Check if user is trip owner
  const { data: trip } = await db.from('trips').select('id, user_id').eq('id', tripId).maybeSingle();
  if (!trip) return { isOwner: false, status: 'none' };
  if (trip.user_id === userId) return { isOwner: true, status: 'approved' };

  // 2. Check local requests store by trip_id and user_id
  const localReq = getLocalRequestByTripAndUser(tripId, userId);
  if (localReq) {
    if (localReq.status === 'approved') return { isOwner: false, status: 'approved' };
    if (localReq.status === 'pending') return { isOwner: false, status: 'pending' };
    if (localReq.status === 'rejected') return { isOwner: false, status: 'rejected' };
  }

  // 3. Find rooms for this trip
  const { data: rooms } = await db.from('rooms').select('id').eq('trip_id', tripId);
  const roomIds = (rooms ?? []).map((r) => r.id);

  if (roomIds.length > 0) {
    // Check local store by room_id and user_id
    for (const rid of roomIds) {
      const byRoom = getLocalRequestByRoomAndUser(rid, userId);
      if (byRoom) {
        if (byRoom.status === 'approved') return { isOwner: false, status: 'approved' };
        if (byRoom.status === 'pending') return { isOwner: false, status: 'pending' };
        if (byRoom.status === 'rejected') return { isOwner: false, status: 'rejected' };
      }
    }

    // Check room_members in DB
    try {
      const { data: members, error } = await db
        .from('room_members')
        .select('id, role, status')
        .in('room_id', roomIds)
        .eq('user_id', userId);

      if (!error && members && members.length > 0) {
        const m = members[0];
        if (m.status === 'pending') return { isOwner: false, status: 'pending' };
        if (m.status === 'rejected') return { isOwner: false, status: 'rejected' };
        return { isOwner: false, status: 'approved' };
      }
    } catch {
      // If status column doesn't exist, try querying without status
      try {
        const { data: fallbackMembers } = await db
          .from('room_members')
          .select('id, role')
          .in('room_id', roomIds)
          .eq('user_id', userId);

        if (fallbackMembers && fallbackMembers.length > 0) {
          return { isOwner: false, status: 'approved' };
        }
      } catch { /* silent */ }
    }
  }

  // 4. Check audit_logs snapshot in Supabase
  try {
    const { data: auditLogs } = await db
      .from('audit_logs')
      .select('details')
      .eq('user_id', userId)
      .eq('action', 'ROOM_REQUEST')
      .order('created_at', { ascending: false })
      .limit(10);

    for (const log of auditLogs ?? []) {
      const det = log.details as Record<string, unknown> | null;
      if (det && det.trip_id === tripId) {
        if (det.status === 'approved') return { isOwner: false, status: 'approved' };
        if (det.status === 'pending') return { isOwner: false, status: 'pending' };
        if (det.status === 'rejected') return { isOwner: false, status: 'rejected' };
      }
    }
  } catch { /* silent */ }

  return { isOwner: false, status: 'none' };
}

export async function getUserTrips(userId: string) {
  const db = getDatabase();

  // Trips the user owns
  const { data: rawOwnedTrips, error } = await db
    .from('trips')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  const ownedTrips = rawOwnedTrips ?? [];
  const ownedTripIds = ownedTrips.map((t) => t.id);

  // Fetch rooms for owned trips cleanly
  if (ownedTripIds.length > 0) {
    try {
      const { data: rooms } = await db.from('rooms').select('id, invite_code, trip_id').in('trip_id', ownedTripIds);
      (ownedTrips as Array<Record<string, unknown>>).forEach((t) => {
        t.rooms = (rooms ?? []).filter((r) => r.trip_id === t.id);
      });
    } catch { /* silent */ }
  }

  // Step 1: get joined trip IDs from Supabase room_members
  const joinedTripIdSet = new Set<string>();

  try {
    const { data: memberships } = await db
      .from('room_members')
      .select('room_id, role, status')
      .eq('user_id', userId)
      .neq('role', 'owner');

    const validRoomIds = (memberships ?? [])
      .filter((m: any) => m.status !== 'pending' && m.status !== 'rejected')
      .map((m: any) => m.room_id);

    if (validRoomIds.length > 0) {
      const { data: rooms } = await db.from('rooms').select('id, trip_id').in('id', validRoomIds);
      (rooms ?? []).forEach((r: any) => { if (r.trip_id) joinedTripIdSet.add(r.trip_id); });
    }
  } catch (err) {
    console.warn('[getUserTrips] room_members fetch error:', err);
  }

  // Step 2: get joined trip IDs from local approved requests
  const localApprovedTrips = getLocalApprovedTripsForUser(userId);
  localApprovedTrips.forEach((tid) => joinedTripIdSet.add(tid));

  // Step 3: get joined trip IDs from audit_logs
  try {
    const { data: auditLogs } = await db
      .from('audit_logs')
      .select('details')
      .eq('user_id', userId)
      .eq('action', 'ROOM_REQUEST')
      .order('created_at', { ascending: false })
      .limit(20);

    for (const log of auditLogs ?? []) {
      const det = log.details as Record<string, unknown> | null;
      if (det && det.status === 'approved' && det.trip_id) {
        joinedTripIdSet.add(det.trip_id as string);
      }
    }
  } catch { /* silent */ }

  // Exclude owned trips from joined trips
  ownedTripIds.forEach((tid) => joinedTripIdSet.delete(tid));

  const joinedTrips: unknown[] = [];
  const joinedTripIds = Array.from(joinedTripIdSet);

  if (joinedTripIds.length > 0) {
    try {
      const { data: tripData } = await db.from('trips').select('*').in('id', joinedTripIds);
      const { data: rooms } = await db.from('rooms').select('id, invite_code, trip_id').in('trip_id', joinedTripIds);

      (tripData ?? []).forEach((t: any) => {
        const tripRooms = (rooms ?? []).filter((r: any) => r.trip_id === t.id);
        joinedTrips.push({
          ...t,
          rooms: tripRooms,
          isOwner: false,
          isJoined: true,
        });
      });
    } catch (err) {
      console.warn('[getUserTrips] joined trips query error:', err);
    }
  }

  console.log(`[getUserTrips] userId=${userId} owned=${ownedTrips.length} joined=${joinedTrips.length}`);
  const pendingCounts = await getPendingRequestsCount(userId);

  return [
    ...ownedTrips.map((t) => ({
      ...t,
      isOwner: true,
      pendingRequestCount: pendingCounts[t.id] ?? 0,
    })),
    ...joinedTrips,
  ];
}

export async function getTripById(tripId: string, userId: string) {
  const db = getDatabase();

  const authCheck = await assertUserTripMembership(tripId, userId);
  if (authCheck.status === 'pending') throw new Error('PENDING');
  if (authCheck.status === 'rejected') throw new Error('REJECTED');
  if (authCheck.status === 'none') throw new Error('Trip not found');

  const { data: trip, error } = await db.from('trips').select('*').eq('id', tripId).maybeSingle();
  if (error || !trip) throw new Error('Trip not found');

  const { data: rooms } = await db.from('rooms').select('id, invite_code').eq('trip_id', tripId);
  const { data: items } = await db
    .from('itinerary_items')
    .select('*')
    .eq('trip_id', tripId)
    .order('day_number')
    .order('order_index');

  return {
    ...trip,
    rooms: rooms ?? [],
    itinerary: items ?? [],
    isOwner: authCheck.isOwner,
  };
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
  if (error) {
    console.warn('[saveItinerary] insert failed, retrying without lat/lng columns:', error.message);
    const strippedRows = rows.map(({ lat: _lat, lng: _lng, ...rest }) => rest);
    const retry = await db.from('itinerary_items').insert(strippedRows);
    if (retry.error) {
      console.error('[saveItinerary] insert without lat/lng also failed:', retry.error.message);
    }
  }
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

  const { error: memberErr } = await db
    .from('room_members')
    .insert({ room_id: room.id, user_id: userId, role: 'owner', status: 'approved' });

  if (memberErr) {
    console.warn('[createRoom] failed with status, retrying with base columns:', memberErr.message);
    await db.from('room_members').insert({ room_id: room.id, user_id: userId, role: 'owner' });
  }

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

  const tripId = (room.trips as unknown as { id: string } | null)?.id || room.trip_id;

  // 1. If user is the creator of the room, they are the convoy leader
  if (room.created_by === userId) {
    return { room, memberStatus: 'owner', isNew: false };
  }

  // Fetch joining user profile info
  let userDetails: { full_name: string; email: string; avatar_url?: string | null } | null = null;
  try {
    const { data: u } = await db.from('users').select('full_name, email, avatar_url').eq('id', userId).maybeSingle();
    if (u) userDetails = { full_name: u.full_name || 'Rider', email: u.email || '', avatar_url: u.avatar_url };
  } catch { /* silent */ }

  // 2. Check if already in Supabase
  try {
    const { data: existing } = await db
      .from('room_members')
      .select('id, status, role')
      .eq('room_id', room.id)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      if (existing.status === 'rejected') {
        // Re-requesting after previous rejection: reset to pending
        try { await db.from('room_members').update({ status: 'pending' }).eq('id', existing.id); } catch { /* silent */ }
        writeLocalRequest({
          id: existing.id,
          room_id: room.id,
          trip_id: tripId,
          user_id: userId,
          status: 'pending',
          role: 'member',
          joined_at: new Date().toISOString(),
          users: userDetails,
        });
        return { room, memberStatus: 'pending', isNew: true };
      }
      return { room, memberStatus: existing.status ?? 'approved', isNew: false };
    }
  } catch { /* silent */ }

  // 3. Check local fallback
  const localReq = getLocalRequestByRoomAndUser(room.id, userId);
  if (localReq) {
    if (localReq.status === 'rejected') {
      const updatedReq: LocalRoomRequest = { ...localReq, status: 'pending', joined_at: new Date().toISOString(), users: userDetails ?? localReq.users };
      writeLocalRequest(updatedReq);
      return { room, memberStatus: 'pending', isNew: true };
    }
    return { room, memberStatus: localReq.status, isNew: false };
  }

  // 4. Create new pending membership
  const newMemberId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  let inserted = false;
  try {
    const { data: ins, error: insErr } = await db
      .from('room_members')
      .insert({ room_id: room.id, user_id: userId, role: 'member', status: 'pending' })
      .select('id, status')
      .single();

    if (!insErr && ins) {
      inserted = true;
      writeLocalRequest({
        id: ins.id,
        room_id: room.id,
        trip_id: tripId,
        user_id: userId,
        status: 'pending',
        role: 'member',
        joined_at: new Date().toISOString(),
        users: userDetails,
      });
    }
  } catch (err) {
    console.warn('[joinRoom] Supabase insert failed, using local store:', err);
  }

  if (!inserted) {
    writeLocalRequest({
      id: newMemberId,
      room_id: room.id,
      trip_id: tripId,
      user_id: userId,
      status: 'pending',
      role: 'member',
      joined_at: new Date().toISOString(),
      users: userDetails,
    });
  }

  // Backup pending request to audit_logs
  try {
    await db.from('audit_logs').insert({
      user_id: userId,
      action: 'ROOM_REQUEST',
      resource: 'rooms',
      resource_id: room.id,
      details: {
        trip_id: tripId,
        user_id: userId,
        role: 'member',
        status: 'pending',
        member_name: userDetails?.full_name ?? '',
      },
    });
  } catch { /* silent */ }

  return { room, memberStatus: 'pending', isNew: true };
}

export async function getRoomMemberStatus(inviteCode: string, userId: string) {
  const db = getDatabase();
  const { data: room, error } = await db
    .from('rooms')
    .select('id, trip_id, created_by, trips(id, title, from_place, to_place, days)')
    .eq('invite_code', inviteCode.toUpperCase())
    .single();

  if (error || !room) throw new Error('Room not found');

  const tripId = (room.trips as unknown as { id: string } | null)?.id || room.trip_id;

  if (room.created_by === userId) {
    return { status: 'owner', tripId, room };
  }

  const { data: existing } = await db
    .from('room_members')
    .select('id, status, role')
    .eq('room_id', room.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing?.status) {
    return { status: existing.status, memberId: existing.id, tripId, room };
  }

  const localReq = getLocalRequestByRoomAndUser(room.id, userId);
  if (localReq?.status) {
    return { status: localReq.status, memberId: localReq.id, tripId, room };
  }

  return { status: 'none', tripId, room };
}

export async function getRoomPreview(inviteCode: string) {
  const db = getDatabase();
  const { data: room, error } = await db
    .from('rooms')
    .select('id, invite_code, created_by, created_at, trips(id, title, from_place, to_place, days, bike_type, preferences)')
    .eq('invite_code', inviteCode.toUpperCase())
    .single();

  if (error || !room) throw new Error('Room not found');

  // Fetch organizer info
  const { data: leader } = await db
    .from('users')
    .select('id, full_name, avatar_url')
    .eq('id', room.created_by)
    .maybeSingle();

  // Try fetching leader's rider profile (bike, style, city)
  let leaderProfile: Record<string, unknown> | null = null;
  try {
    const { data: lp } = await db
      .from('rider_profiles')
      .select('bike_model, riding_style, city')
      .eq('user_id', room.created_by)
      .maybeSingle();
    leaderProfile = lp;
    if (!leaderProfile) {
      const localProfiles = readLocalProfiles();
      if (localProfiles[room.created_by]) {
        leaderProfile = localProfiles[room.created_by];
      }
    }
    if (!leaderProfile) {
      const { data: fallbackLog } = await db
        .from('audit_logs')
        .select('details')
        .eq('user_id', room.created_by)
        .eq('action', 'RIDER_PROFILE')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (fallbackLog?.details) leaderProfile = fallbackLog.details as Record<string, unknown>;
    }
  } catch { /* silent fallback */ }

  // Count approved members
  let memberCount = 1; // starts with the leader
  try {
    const { count } = await db
      .from('room_members')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room.id)
      .eq('status', 'approved')
      .neq('role', 'owner');
    if (typeof count === 'number') memberCount += count;
  } catch { /* silent */ }

  // Get first 5 stops preview
  const trip = room.trips as unknown as { id: string };
  let stopsPreview: Array<{ place: string; item_type: string; day_number: number }> = [];
  if (trip?.id) {
    try {
      const { data: stops } = await db
        .from('itinerary_items')
        .select('place, item_type, day_number')
        .eq('trip_id', trip.id)
        .order('day_number')
        .order('order_index')
        .limit(5);
      stopsPreview = stops ?? [];
    } catch { /* silent */ }
  }

  return {
    ...room,
    leader: leader ? {
      fullName: leader.full_name || 'Convoy Leader',
      avatarUrl: leader.avatar_url,
      bikeModel: (leaderProfile?.bike_model as string) || null,
      ridingStyle: (leaderProfile?.riding_style as string) || null,
      city: (leaderProfile?.city as string) || null,
    } : null,
    memberCount,
    stopsPreview,
  };
}

export async function getApprovedMembers(tripId: string, currentUserId: string) {
  const db = getDatabase();

  const auth = await assertUserTripMembership(tripId, currentUserId);
  if (auth.status !== 'approved') throw new Error('Not authorized');

  const { data: rooms } = await db.from('rooms').select('id').eq('trip_id', tripId);
  const roomIds = (rooms ?? []).map((r) => r.id);

  let dbMembers: Array<{
    id: string;
    user_id: string;
    role: string;
    status: string;
    joined_at: string;
    users?: { full_name: string; email: string; avatar_url?: string | null } | null;
  }> = [];

  if (roomIds.length > 0) {
    try {
      const { data: members, error } = await db
        .from('room_members')
        .select('id, user_id, role, status, joined_at, users(full_name, email, avatar_url)')
        .in('room_id', roomIds)
        .neq('role', 'owner');

      if (!error && members) {
        dbMembers = (members as any[]).filter((m) => m.status !== 'pending' && m.status !== 'rejected');
      }
    } catch {
      try {
        const { data: fallbackMembers } = await db
          .from('room_members')
          .select('id, user_id, role, joined_at, users(full_name, email, avatar_url)')
          .in('room_id', roomIds)
          .neq('role', 'owner');

        if (fallbackMembers) {
          dbMembers = fallbackMembers.map((m: any) => ({ ...m, status: 'approved' }));
        }
      } catch { /* silent */ }
    }
  }

  // Merge local approved requests
  const localReqs = getLocalRequestsForTrip(tripId).filter(
    (r) => r.status === 'approved' && r.role !== 'owner'
  );
  if (roomIds.length > 0) {
    for (const rid of roomIds) {
      const rReqs = getLocalRequestsForRoom(rid).filter(
        (r) => r.status === 'approved' && r.role !== 'owner'
      );
      localReqs.push(...rReqs);
    }
  }

  const seenUserIds = new Set(dbMembers.map((m) => m.user_id));
  const seenMemberIds = new Set(dbMembers.map((m) => m.id));

  for (const lr of localReqs) {
    if (!seenUserIds.has(lr.user_id) && !seenMemberIds.has(lr.id)) {
      dbMembers.push({
        id: lr.id,
        user_id: lr.user_id,
        role: lr.role,
        status: lr.status,
        joined_at: lr.joined_at,
        users: lr.users ?? null,
      });
      seenUserIds.add(lr.user_id);
      seenMemberIds.add(lr.id);
    }
  }

  // Ensure all members have user name/email info
  for (const m of dbMembers) {
    if (!m.users?.full_name || !m.users?.email) {
      try {
        const { data: u } = await db.from('users').select('full_name, email, avatar_url').eq('id', m.user_id).maybeSingle();
        if (u) {
          m.users = { full_name: u.full_name || 'Rider', email: u.email || '', avatar_url: u.avatar_url };
        }
      } catch { /* silent */ }
    }
  }

  // Enrich with rider profiles if available
  const userIds = dbMembers.map((m) => m.user_id);
  let profilesMap: Record<string, Record<string, unknown>> = {};
  if (userIds.length > 0) {
    try {
      const { data: profiles } = await db
        .from('rider_profiles')
        .select('user_id, phone, blood_group, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, bike_model, bike_reg_no, city')
        .in('user_id', userIds);

      if (profiles && profiles.length > 0) {
        profilesMap = Object.fromEntries(profiles.map((p) => [p.user_id, p]));
      } else {
        const localProfiles = readLocalProfiles();
        for (const uid of userIds) {
          if (localProfiles[uid]) {
            profilesMap[uid] = localProfiles[uid];
          }
        }
        const { data: logs } = await db
          .from('audit_logs')
          .select('user_id, details')
          .eq('action', 'RIDER_PROFILE')
          .in('user_id', userIds)
          .order('created_at', { ascending: false });
        if (logs) {
          for (const l of logs) {
            if (!profilesMap[l.user_id] && l.details) {
              profilesMap[l.user_id] = l.details as Record<string, unknown>;
            }
          }
        }
      }
    } catch { /* silent */ }
  }

  return dbMembers.map((m) => ({
    ...m,
    profile: profilesMap[m.user_id] ?? null,
  }));
}

export async function getPendingRequests(tripId: string, ownerId: string) {
  const db = getDatabase();

  const { data: trip } = await db.from('trips').select('id').eq('id', tripId).eq('user_id', ownerId).maybeSingle();
  if (!trip) throw new Error('Not authorized');

  const { data: room } = await db.from('rooms').select('id').eq('trip_id', tripId).single();
  if (!room) throw new Error('Room not found');

  let dbMembers: Array<{
    id: string;
    user_id: string;
    role: string;
    status: string;
    joined_at: string;
    users?: { full_name: string; email: string; avatar_url?: string | null } | null;
  }> = [];

  try {
    const { data: members, error } = await db
      .from('room_members')
      .select('id, user_id, role, status, joined_at, users(full_name, email, avatar_url)')
      .eq('room_id', room.id)
      .eq('status', 'pending');
    if (!error && members) {
      dbMembers = members as unknown as typeof dbMembers;
    }
  } catch (err) {
    console.warn('[getPendingRequests] Supabase fetch error, will merge local store:', err);
  }

  // Merge local requests
  const localReqs = getLocalRequestsForRoom(room.id).filter((r) => r.status === 'pending');
  const seenUserIds = new Set(dbMembers.map((m) => m.user_id));
  const seenMemberIds = new Set(dbMembers.map((m) => m.id));

  for (const lr of localReqs) {
    if (!seenUserIds.has(lr.user_id) && !seenMemberIds.has(lr.id)) {
      dbMembers.push({
        id: lr.id,
        user_id: lr.user_id,
        role: lr.role,
        status: lr.status,
        joined_at: lr.joined_at,
        users: lr.users ?? null,
      });
      seenUserIds.add(lr.user_id);
      seenMemberIds.add(lr.id);
    }
  }

  // Ensure all members have user name/email info
  for (const m of dbMembers) {
    if (!m.users?.full_name || !m.users?.email) {
      try {
        const { data: u } = await db.from('users').select('full_name, email, avatar_url').eq('id', m.user_id).maybeSingle();
        if (u) {
          m.users = { full_name: u.full_name || 'Rider', email: u.email || '', avatar_url: u.avatar_url };
        }
      } catch { /* silent */ }
    }
  }

  // Enrich with rider profiles
  const userIds = dbMembers.map((m) => m.user_id);
  let profilesMap: Record<string, Record<string, unknown>> = {};
  if (userIds.length > 0) {
    try {
      const { data: profiles } = await db
        .from('rider_profiles')
        .select('user_id, phone, blood_group, bike_model, city')
        .in('user_id', userIds);

      if (profiles && profiles.length > 0) {
        profilesMap = Object.fromEntries(profiles.map((p) => [p.user_id, p]));
      } else {
        const localProfiles = readLocalProfiles();
        for (const uid of userIds) {
          if (localProfiles[uid]) {
            profilesMap[uid] = localProfiles[uid];
          }
        }
      }
    } catch {
      const localProfiles = readLocalProfiles();
      for (const uid of userIds) {
        if (localProfiles[uid]) {
          profilesMap[uid] = localProfiles[uid];
        }
      }
    }
  }

  return dbMembers.map((m) => ({
    ...m,
    profile: profilesMap[m.user_id] ?? null,
  }));
}

export async function respondToRequest(roomMemberId: string, action: 'approved' | 'rejected', ownerId: string) {
  const db = getDatabase();

  // Try DB first
  const { data: member } = await db
    .from('room_members')
    .select('id, user_id, room_id, rooms(trip_id)')
    .eq('id', roomMemberId)
    .maybeSingle();

  if (member) {
    const tripId = (member.rooms as unknown as { trip_id: string } | null)?.trip_id;
    if (tripId) {
      const { data: trip } = await db.from('trips').select('id').eq('id', tripId).eq('user_id', ownerId).maybeSingle();
      if (!trip) throw new Error('Not authorized');
    }
    try {
      await db.from('room_members').update({ status: action }).eq('id', roomMemberId);
    } catch { /* status column might not exist */ }
    updateLocalRequestStatus(roomMemberId, action);
    try {
      await db.from('audit_logs').insert({
        user_id: member.user_id,
        action: 'ROOM_REQUEST',
        resource: 'rooms',
        resource_id: member.room_id,
        details: { trip_id: tripId, user_id: member.user_id, role: 'member', status: action },
      });
    } catch { /* silent */ }
    return;
  }

  // If not found in DB room_members, check local store
  const allLocal = readLocalRequests();
  const localTarget = allLocal[roomMemberId] || Object.values(allLocal).find((r) => r.id === roomMemberId || r.user_id === roomMemberId);
  if (!localTarget) throw new Error('Request not found');

  const { data: trip } = await db.from('trips').select('id').eq('id', localTarget.trip_id).eq('user_id', ownerId).maybeSingle();
  if (!trip) throw new Error('Not authorized');

  updateLocalRequestStatus(localTarget.id, action);

  // Sync to room_members in DB
  try {
    const upsertRes = await db.from('room_members').upsert({
      room_id: localTarget.room_id,
      user_id: localTarget.user_id,
      role: 'member',
      status: action,
    });
    if (upsertRes.error && action === 'approved') {
      await db.from('room_members').upsert({
        room_id: localTarget.room_id,
        user_id: localTarget.user_id,
        role: 'member',
      });
    }
  } catch {
    if (action === 'approved') {
      try {
        await db.from('room_members').upsert({
          room_id: localTarget.room_id,
          user_id: localTarget.user_id,
          role: 'member',
        });
      } catch { /* silent */ }
    }
  }

  // Backup to audit_logs
  try {
    await db.from('audit_logs').insert({
      user_id: localTarget.user_id,
      action: 'ROOM_REQUEST',
      resource: 'rooms',
      resource_id: localTarget.room_id,
      details: {
        trip_id: localTarget.trip_id,
        user_id: localTarget.user_id,
        role: 'member',
        status: action,
        member_name: localTarget.users?.full_name ?? '',
      },
    });
  } catch { /* silent */ }
}

export async function getPendingRequestsCount(userId: string): Promise<Record<string, number>> {
  const db = getDatabase();
  const counts: Record<string, number> = {};

  try {
    const { data: trips } = await db.from('trips').select('id, rooms(id)').eq('user_id', userId);
    if (!trips || trips.length === 0) return counts;

    const roomToTrip: Record<string, string> = {};
    const roomIds: string[] = [];

    for (const t of trips) {
      counts[t.id] = 0;
      const rms = (t.rooms as Array<{ id: string }>) || [];
      for (const r of rms) {
        roomToTrip[r.id] = t.id;
        roomIds.push(r.id);
      }
    }

    if (roomIds.length > 0) {
      const { data: pendingMembers } = await db
        .from('room_members')
        .select('room_id')
        .in('room_id', roomIds)
        .eq('status', 'pending');

      for (const pm of pendingMembers ?? []) {
        const tid = roomToTrip[pm.room_id];
        if (tid) counts[tid] = (counts[tid] || 0) + 1;
      }
    }

    // Merge local requests
    const allLocal = readLocalRequests();
    for (const r of Object.values(allLocal)) {
      if (r.status === 'pending' && r.trip_id && counts[r.trip_id] !== undefined) {
        counts[r.trip_id] = (counts[r.trip_id] || 0) + 1;
      }
    }
  } catch (err) {
    console.warn('[getPendingRequestsCount] error:', err);
  }

  return counts;
}

export async function removeMember(tripId: string, roomMemberId: string, currentUserId: string) {
  const db = getDatabase();

  const { data: member } = await db
    .from('room_members')
    .select('id, user_id, room_id, rooms(trip_id)')
    .eq('id', roomMemberId)
    .single();

  if (!member) throw new Error('Member not found');

  const { data: trip } = await db
    .from('trips')
    .select('id, user_id')
    .eq('id', tripId)
    .single();

  if (!trip) throw new Error('Trip not found');

  const isOwner = trip.user_id === currentUserId;
  const isSelf = member.user_id === currentUserId;

  if (!isOwner && !isSelf) {
    throw new Error('Not authorized to remove member');
  }

  const { error } = await db.from('room_members').delete().eq('id', roomMemberId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function updateItinerary(tripId: string, userId: string, stops: Array<{
  id?: string; day_number: number; order_index: number; place: string; description?: string;
  item_type?: string; estimated_km?: number; duration_hours?: number; tips?: string;
  lat?: number; lng?: number;
}>) {
  const db = getDatabase();
  const auth = await assertUserTripMembership(tripId, userId);
  if (auth.status !== 'approved') throw new Error('Not authorized');

  await db.from('itinerary_items').delete().eq('trip_id', tripId);
  if (stops.length > 0) {
    const { error } = await db.from('itinerary_items').insert(
      stops.map(({ id: _id, ...s }) => ({ ...s, trip_id: tripId }))
    );
    if (error) throw new Error(error.message);
  }
}

export async function addStopToTrip(
  tripId: string,
  userId: string,
  stop: {
    place: string;
    item_type?: string;
    description?: string;
    day_number?: number;
    order_index?: number;
    lat?: number | null;
    lng?: number | null;
  }
) {
  const db = getDatabase();
  const auth = await assertUserTripMembership(tripId, userId);
  if (auth.status !== 'approved') throw new Error('Not authorized');

  let day = stop.day_number ?? 1;
  const { data: existingStops } = await db
    .from('itinerary_items')
    .select('day_number, order_index')
    .eq('trip_id', tripId)
    .order('day_number', { ascending: false })
    .order('order_index', { ascending: false });

  let orderIndex = 1;
  if (existingStops && existingStops.length > 0) {
    if (!stop.day_number) {
      day = existingStops[0].day_number;
    }
    const dayStops = existingStops.filter((s) => s.day_number === day);
    if (dayStops.length > 0) {
      orderIndex = Math.max(...dayStops.map((s) => s.order_index)) + 1;
    }
  }

  const { data, error } = await db
    .from('itinerary_items')
    .insert({
      trip_id: tripId,
      day_number: day,
      order_index: stop.order_index ?? orderIndex,
      place: stop.place,
      item_type: stop.item_type || 'stop',
      description: stop.description || 'Added from chat/live',
      estimated_km: 0,
      duration_hours: 1,
      tips: '',
      lat: stop.lat ?? null,
      lng: stop.lng ?? null,
    })
    .select()
    .single();

  if (error) {
    // Retry without lat/lng if column issues exist
    const { data: retryData, error: retryErr } = await db
      .from('itinerary_items')
      .insert({
        trip_id: tripId,
        day_number: day,
        order_index: stop.order_index ?? orderIndex,
        place: stop.place,
        item_type: stop.item_type || 'stop',
        description: stop.description || 'Added from chat/live',
        estimated_km: 0,
        duration_hours: 1,
        tips: '',
      })
      .select()
      .single();
    if (retryErr) throw new Error(retryErr.message);
    return retryData;
  }
  return data;
}

export async function getAllTripParticipants(tripId: string, userId: string) {
  const db = getDatabase();

  const auth = await assertUserTripMembership(tripId, userId);
  if (auth.status !== 'approved') throw new Error('Not authorized');

  const { data: trip } = await db.from('trips').select('id, user_id').eq('id', tripId).maybeSingle();
  if (!trip) throw new Error('Trip not found');

  const { data: owner } = await db.from('users').select('id, full_name, email').eq('id', trip.user_id).single();
  const approved = await getApprovedMembers(tripId, userId);

  return [
    { id: owner!.id, full_name: owner!.full_name ?? 'Lead Rider', email: owner!.email, role: 'owner' as const },
    ...approved.map((m) => ({
      id: m.user_id,
      full_name: m.users?.full_name ?? 'Rider',
      email: m.users?.email ?? '',
      role: 'member' as const,
    })),
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
