import { getDatabase } from '../config/database';
import { generateItinerary } from './ai.service';

interface CreateTripData {
  title: string;
  from_place: string;
  to_place: string;
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

  const { data: trip, error } = await db
    .from('trips')
    .insert({ ...data, title, user_id: userId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return trip;
}

export async function getUserTrips(userId: string) {
  const db = getDatabase();
  const { data, error } = await db
    .from('trips')
    .select('*, rooms(id, invite_code)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getTripById(tripId: string, userId: string) {
  const db = getDatabase();
  const { data: trip, error } = await db
    .from('trips')
    .select('*, rooms(id, invite_code)')
    .eq('id', tripId)
    .eq('user_id', userId)
    .single();

  if (error) throw new Error(error.message);

  const { data: items } = await db
    .from('itinerary_items')
    .select('*')
    .eq('trip_id', tripId)
    .order('day_number')
    .order('order_index');

  return { ...trip, itinerary: items ?? [] };
}

export async function saveItinerary(tripId: string, itineraryDays: Awaited<ReturnType<typeof generateItinerary>>) {
  const db = getDatabase();
  const rows = itineraryDays.flatMap((day) =>
    day.stops.map((stop) => ({
      trip_id: tripId,
      day_number: day.day,
      order_index: stop.order,
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

  await db.from('room_members').insert({ room_id: room.id, user_id: userId, role: 'owner' });

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
    .select('id')
    .eq('room_id', room.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (!existing) {
    await db.from('room_members').insert({ room_id: room.id, user_id: userId, role: 'member' });
  }

  return room;
}

export async function updateItinerary(tripId: string, userId: string, stops: Array<{
  day_number: number; order_index: number; place: string; description?: string;
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
