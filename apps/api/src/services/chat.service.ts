import crypto from 'crypto';
import { getDatabase } from '../config/database';
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { assertUserTripMembership, getUserTrips, addStopToTrip, getTripMemberIds } from './trip.service';
import { sendPush } from './push.service';

const MAX_BODY = 2000;
const DM_UNREPLIED_LIMIT = 5;

type ConvType = 'trip' | 'group' | 'dm';
interface ParsedKey {
  type: ConvType;
  id: string; // trip id, group id, or the other user's id for a DM
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function dmKey(a: string, b: string): string {
  return `dm:${[a, b].sort().join(':')}`;
}

function parseKey(key: string, userId: string): ParsedKey {
  const [type, ...rest] = key.split(':');
  if (type === 'trip' || type === 'group') {
    if (rest.length === 1 && UUID.test(rest[0])) return { type, id: rest[0] };
  }
  if (type === 'dm' && rest.length === 2 && rest.every((r) => UUID.test(r)) && rest.includes(userId)) {
    const other = rest[0] === userId ? rest[1] : rest[0];
    if (other !== userId) return { type: 'dm', id: other };
  }
  throw new ValidationError('Unknown conversation');
}

/** Throws unless the user may read and write this conversation. */
async function authorize(key: string, userId: string): Promise<ParsedKey & { isLead: boolean }> {
  const parsed = parseKey(key, userId);
  const db = getDatabase();

  if (parsed.type === 'trip') {
    const m = await assertUserTripMembership(parsed.id, userId);
    if (m.status !== 'approved') throw new ForbiddenError('You are not on this trip');
    return { ...parsed, isLead: m.isOwner };
  }
  if (parsed.type === 'group') {
    const { data } = await db
      .from('chat_group_members')
      .select('role, status')
      .eq('group_id', parsed.id)
      .eq('user_id', userId)
      .maybeSingle();
    if (!data || data.status !== 'member') throw new ForbiddenError('You are not in this group');
    return { ...parsed, isLead: data.role === 'admin' };
  }
  const { data: other } = await db.from('users').select('id, status').eq('id', parsed.id).maybeSingle();
  if (!other || other.status !== 'active') throw new NotFoundError('Rider');
  return { ...parsed, isLead: false };
}

interface MessageRow {
  id: string;
  conversation_key: string;
  sender_id: string;
  kind: 'text' | 'location';
  body: string;
  meta: Record<string, unknown> | null;
  created_at: string;
}

async function nameMap(ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return {};
  const { data } = await getDatabase().from('users').select('id, full_name').in('id', unique);
  const out: Record<string, string> = {};
  (data ?? []).forEach((u) => { out[u.id] = u.full_name || 'Rider'; });
  return out;
}

function shape(m: MessageRow, names: Record<string, string>, userId: string) {
  return {
    id: m.id,
    senderId: m.sender_id,
    senderName: names[m.sender_id] || 'Rider',
    mine: m.sender_id === userId,
    kind: m.kind,
    body: m.body,
    meta: m.meta,
    createdAt: m.created_at,
  };
}

export async function getMessages(key: string, userId: string, since?: string) {
  const auth = await authorize(key, userId);
  const db = getDatabase();
  let q = db.from('chat_messages').select('*').eq('conversation_key', key);
  if (since) q = q.gt('created_at', since);
  const { data, error } = await q.order('created_at', { ascending: true }).limit(300);
  if (error) throw new Error(`Failed to load messages: ${error.message}`);
  const rows = (data ?? []) as MessageRow[];
  const names = await nameMap(rows.map((r) => r.sender_id));

  await db
    .from('chat_reads')
    .upsert({ user_id: userId, conversation_key: key, last_read_at: new Date().toISOString(), marked_unread: false });

  let dmState: { sentUnreplied: number; blocked: boolean; limit: number } | undefined;
  if (auth.type === 'dm') dmState = await dmStatus(key, userId);
  return { messages: rows.map((r) => shape(r, names, userId)), dm: dmState, isLead: auth.isLead };
}

/** New conversations can send a few messages before the other rider has to reply. */
async function dmStatus(key: string, userId: string) {
  const { data } = await getDatabase().from('chat_messages').select('sender_id').eq('conversation_key', key);
  const rows = data ?? [];
  const mine = rows.filter((r) => r.sender_id === userId).length;
  const theirs = rows.length - mine;
  const sentUnreplied = theirs > 0 ? 0 : mine;
  return { sentUnreplied, blocked: sentUnreplied >= DM_UNREPLIED_LIMIT, limit: DM_UNREPLIED_LIMIT };
}

export interface SendInput {
  kind?: 'text' | 'location';
  body?: string;
  place?: string;
  note?: string;
  lat?: number;
  lng?: number;
  liveMinutes?: 15 | 60 | 480;
}

export async function sendMessage(key: string, userId: string, input: SendInput) {
  const auth = await authorize(key, userId);
  if (auth.type === 'group' && !auth.isLead) {
    const { data: g } = await getDatabase().from('chat_groups').select('only_admins_post').eq('id', auth.id).maybeSingle();
    if (g?.only_admins_post) throw new ForbiddenError('Only admins can post in this group');
  }
  const kind = input.kind === 'location' ? 'location' : 'text';
  let body = (input.body ?? '').trim();
  let meta: Record<string, unknown> | null = null;

  if (kind === 'location') {
    if (auth.type !== 'trip') throw new ValidationError('Locations can only be shared in a trip chat');
    const live = input.liveMinutes ? new Date(Date.now() + input.liveMinutes * 60000).toISOString() : null;
    const place = (input.place ?? '').trim().slice(0, 120) || (live ? 'Live location' : 'My location');
    if (typeof input.lat !== 'number' || typeof input.lng !== 'number' ||
        Math.abs(input.lat) > 90 || Math.abs(input.lng) > 180) {
      throw new ValidationError('Location is missing');
    }
    body = place;
    meta = { place, lat: input.lat, lng: input.lng, confirmed: false, ...((input.note ?? '').trim() ? { note: (input.note ?? '').trim().slice(0, 200) } : {}), ...(live ? { live: { until: live }, updatedAt: new Date().toISOString() } : {}) };
  } else {
    if (!body) throw new ValidationError('Write a message first');
    if (body.length > MAX_BODY) throw new ValidationError(`Messages can be up to ${MAX_BODY} characters`);
  }

  if (auth.type === 'dm') {
    const st = await dmStatus(key, userId);
    if (st.blocked) {
      throw new AppError(429, 'DM_LIMIT', 'Wait for them to reply before sending more messages.');
    }
  }

  const { data, error } = await getDatabase()
    .from('chat_messages')
    .insert({ conversation_key: key, sender_id: userId, kind, body, meta })
    .select()
    .single();
  if (error || !data) throw new Error(`Failed to send message: ${error?.message}`);
  const names = await nameMap([userId]);
  void notifyChat(auth, key, userId, kind, body, names[userId] ?? 'Rider', meta);
  return shape(data as MessageRow, names, userId);
}

/** Push to everyone else in the conversation. Best effort, never blocks the send. */
async function notifyChat(
  auth: ParsedKey, key: string, senderId: string, kind: string, body: string, senderName: string, meta: Record<string, unknown> | null,
) {
  try {
    let recipients: string[] = [];
    let title = senderName;
    if (auth.type === 'dm') {
      recipients = [auth.id];
    } else if (auth.type === 'trip') {
      recipients = await getTripMemberIds(auth.id);
      const { data: trip } = await getDatabase().from('trips').select('title').eq('id', auth.id).maybeSingle();
      title = `${senderName} in ${trip?.title ?? 'your trip'}`;
    } else {
      const { data: g } = await getDatabase().from('chat_group_members').select('user_id').eq('group_id', auth.id).eq('status', 'member');
      recipients = (g ?? []).map((m) => m.user_id as string);
      const { data: grp } = await getDatabase().from('chat_groups').select('name').eq('id', auth.id).maybeSingle();
      title = `${senderName} in ${grp?.name ?? 'group'}`;
    }
    recipients = recipients.filter((id) => id !== senderId);
    await sendPush(recipients, {
      title,
      body: kind === 'location' ? (meta && (meta as { live?: unknown }).live ? 'Started sharing live location' : `Shared a place: ${body}`) : body.slice(0, 140),
      url: `/chat?c=${encodeURIComponent(key)}`,
      tag: `chat:${key}`,
    });
  } catch { /* ignore */ }
}

async function ownLiveMessage(key: string, userId: string, messageId: string) {
  const auth = await authorize(key, userId);
  if (auth.type !== 'trip') throw new ValidationError('Live location is for trip chats');
  const db = getDatabase();
  const { data: msg } = await db.from('chat_messages').select('*')
    .eq('id', messageId).eq('conversation_key', key).maybeSingle();
  if (!msg || msg.kind !== 'location' || !msg.meta?.live) throw new NotFoundError('Live location');
  if (msg.sender_id !== userId) throw new ForbiddenError('Only the sender can update a live location');
  return msg;
}

/** The sender's phone calls this every few seconds while a live location is on. */
export async function updateLiveLocation(key: string, userId: string, messageId: string, lat: number, lng: number) {
  const msg = await ownLiveMessage(key, userId, messageId);
  const until = new Date(msg.meta.live.until as string).getTime();
  if (Date.now() >= until) return { active: false };
  await getDatabase().from('chat_messages')
    .update({ meta: { ...msg.meta, lat, lng, updatedAt: new Date().toISOString() } }).eq('id', messageId);
  return { active: true };
}

export async function stopLiveLocation(key: string, userId: string, messageId: string) {
  const msg = await ownLiveMessage(key, userId, messageId);
  await getDatabase().from('chat_messages')
    .update({ meta: { ...msg.meta, live: { until: new Date().toISOString() } } }).eq('id', messageId);
  return { active: false };
}

/** Trip leader turns a shared location into a stop everyone sees on the itinerary. */
export async function confirmStop(key: string, userId: string, messageId: string) {
  const auth = await authorize(key, userId);
  if (auth.type !== 'trip') throw new ValidationError('Only trip chats have stops');
  if (!auth.isLead) throw new ForbiddenError('Only the trip captain can confirm a stop');

  const db = getDatabase();
  const { data: msg } = await db
    .from('chat_messages')
    .select('*')
    .eq('id', messageId)
    .eq('conversation_key', key)
    .maybeSingle();
  if (!msg || msg.kind !== 'location' || !msg.meta) throw new NotFoundError('Shared location');
  if (msg.meta.confirmed) return { alreadyConfirmed: true };

  const meta = msg.meta as { place: string; lat: number; lng: number };
  await addStopToTrip(auth.id, userId, {
    place: meta.place,
    item_type: 'stop',
    description: 'Added from trip chat',
    lat: meta.lat,
    lng: meta.lng,
  });
  await db.from('chat_messages').update({ meta: { ...msg.meta, confirmed: true } }).eq('id', messageId);
  return { alreadyConfirmed: false };
}

export async function listConversations(userId: string) {
  const db = getDatabase();
  const out: Array<{
    key: string; type: ConvType; title: string; subtitle: string;
    lastMessage: string | null; lastAt: string | null; unread: number;
    lastSender?: string | null; lastMine?: boolean; markedUnread?: boolean;
  }> = [];

  const tripData = await getUserTrips(userId);
  const trips = (tripData as Array<{ id: string; title: string; from_place: string; to_place: string }>) ?? [];
  const tripIds = trips.map((t) => t.id);
  const chatNames: Record<string, string> = {};
  if (tripIds.length) {
    const { data: cn } = await db.from('trips').select('id, chat_name').in('id', tripIds);
    (cn ?? []).forEach((r) => { if (r.chat_name) chatNames[r.id as string] = r.chat_name as string; });
  }
  trips.forEach((t) =>
    out.push({
      key: `trip:${t.id}`, type: 'trip', title: chatNames[t.id] ?? t.title,
      subtitle: `${t.from_place} to ${t.to_place}`, lastMessage: null, lastAt: null, unread: 0,
    }),
  );

  const { data: memberships } = await db
    .from('chat_group_members')
    .select('group_id, chat_groups(id, name, region)')
    .eq('user_id', userId)
    .eq('status', 'member');
  (memberships ?? []).forEach((m) => {
    const g = (m as unknown as { chat_groups: { id: string; name: string; region: string | null } | null }).chat_groups;
    if (g) out.push({ key: `group:${g.id}`, type: 'group', title: g.name, subtitle: g.region ? `Group, ${g.region}` : 'Group', lastMessage: null, lastAt: null, unread: 0 });
  });

  // Direct messages: every dm thread this user is in.
  const { data: dmRows } = await db
    .from('chat_messages')
    .select('conversation_key')
    .like('conversation_key', 'dm:%')
    .ilike('conversation_key', `%${userId}%`);
  const dmKeys = [...new Set((dmRows ?? []).map((r) => r.conversation_key as string))];
  const otherIds = dmKeys.map((k) => k.split(':').slice(1).find((id) => id !== userId)!).filter(Boolean);
  const names = await nameMap(otherIds);
  dmKeys.forEach((k, i) =>
    out.push({
      key: k, type: 'dm', title: names[otherIds[i]] || 'Rider', subtitle: 'Direct message',
      lastMessage: null, lastAt: null, unread: 0,
    }),
  );

  if (!out.length) return out;
  const keys = out.map((c) => c.key);
  const [{ data: reads }, { data: recent }] = await Promise.all([
    db.from('chat_reads').select('conversation_key, last_read_at, marked_unread').eq('user_id', userId).in('conversation_key', keys),
    db.from('chat_messages').select('conversation_key, sender_id, kind, body, created_at')
      .in('conversation_key', keys).order('created_at', { ascending: false }).limit(1000),
  ]);
  const readAt: Record<string, string> = {};
  const flagged = new Set<string>();
  (reads ?? []).forEach((r) => { readAt[r.conversation_key] = r.last_read_at; if (r.marked_unread) flagged.add(r.conversation_key); });
  const senderNames = await nameMap((recent ?? []).map((m) => m.sender_id as string));
  out.forEach((c) => {
    const msgs = (recent ?? []).filter((m) => m.conversation_key === c.key);
    if (msgs[0]) {
      c.lastMessage = msgs[0].kind === 'location' ? `Shared location: ${msgs[0].body}` : msgs[0].body;
      c.lastAt = msgs[0].created_at;
      c.lastMine = msgs[0].sender_id === userId;
      c.lastSender = c.lastMine ? 'You' : (senderNames[msgs[0].sender_id as string] ?? null);
    }
    const count = msgs.filter((m) => m.sender_id !== userId && (!readAt[c.key] || m.created_at > readAt[c.key])).length;
    c.markedUnread = flagged.has(c.key);
    c.unread = count > 0 ? count : (c.markedUnread ? 1 : 0);
  });
  out.sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''));
  return out;
}

export async function unreadCount(userId: string, stopsOnly: boolean) {
  const convs = await listConversations(userId);
  if (!stopsOnly) return { unread: convs.reduce((n, c) => n + c.unread, 0) };
  // "Stops and alerts only": count unread shared locations in trip chats. Two queries in total.
  const db = getDatabase();
  const keys = convs.filter((x) => x.type === 'trip' && x.unread > 0).map((c) => c.key);
  if (keys.length === 0) return { unread: 0 };
  const [{ data: reads }, { data: locs }] = await Promise.all([
    db.from('chat_reads').select('conversation_key, last_read_at').eq('user_id', userId).in('conversation_key', keys),
    db.from('chat_messages').select('conversation_key, created_at')
      .in('conversation_key', keys).eq('kind', 'location').neq('sender_id', userId),
  ]);
  const readAt = new Map((reads ?? []).map((r) => [r.conversation_key as string, r.last_read_at as string | null]));
  const n = (locs ?? []).filter((m) => {
    const last = readAt.get(m.conversation_key as string);
    return !last || (m.created_at as string) > last;
  }).length;
  return { unread: n };
}

/** People you ride with (same trips or groups), for starting a direct message. */
export async function listContacts(userId: string) {
  const db = getDatabase();
  const ids = new Set<string>();

  const { data: myGroups } = await db.from('chat_group_members').select('group_id').eq('user_id', userId).eq('status', 'member');
  const groupIds = (myGroups ?? []).map((g) => g.group_id);
  if (groupIds.length) {
    const { data } = await db.from('chat_group_members').select('user_id').in('group_id', groupIds).eq('status', 'member');
    (data ?? []).forEach((r) => ids.add(r.user_id));
  }

  const trips = ((await getUserTrips(userId)) as Array<{ id: string; user_id?: string }>) ?? [];
  const tripIds = trips.map((t) => t.id);
  if (tripIds.length) {
    const { data: rooms } = await db.from('rooms').select('id, trip_id').in('trip_id', tripIds);
    const roomIds = (rooms ?? []).map((r) => r.id);
    if (roomIds.length) {
      const { data } = await db.from('room_members').select('user_id').in('room_id', roomIds).eq('status', 'approved');
      (data ?? []).forEach((r) => ids.add(r.user_id));
    }
    const { data: owners } = await db.from('trips').select('user_id').in('id', tripIds);
    (owners ?? []).forEach((r) => ids.add(r.user_id));
  }
  ids.delete(userId);
  if (!ids.size) return [];
  const { data: users } = await db.from('users').select('id, full_name, city').in('id', [...ids]).eq('status', 'active');
  return (users ?? [])
    .filter((u) => u.full_name)
    .map((u) => ({ userId: u.id as string, name: u.full_name as string, city: (u.city as string) ?? null, key: dmKey(userId, u.id) }));
}

// ----------------------------- groups -----------------------------

function newInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[crypto.randomInt(alphabet.length)];
  return `${s.slice(0, 3)}-${s.slice(3)}`;
}

export async function createGroup(userId: string, rawName: string) {
  const name = rawName.trim();
  if (name.length < 2 || name.length > 100) throw new ValidationError('Group name must be 2 to 100 characters');
  const db = getDatabase();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await db
      .from('chat_groups')
      .insert({ name, invite_code: newInviteCode(), created_by: userId })
      .select()
      .single();
    if (error?.code === '23505') continue; // invite code clash, try another
    if (error || !data) throw new Error(`Failed to create group: ${error?.message}`);
    await db.from('chat_group_members').insert({ group_id: data.id, user_id: userId, role: 'admin', status: 'member' });
    return { id: data.id as string, name: data.name as string, inviteCode: data.invite_code as string };
  }
  throw new Error('Could not create a unique invite code');
}

export async function requestToJoinGroup(userId: string, rawCode: string) {
  const code = rawCode.trim().toUpperCase();
  const db = getDatabase();
  const { data: group } = await db.from('chat_groups').select('id, name, require_approval').eq('invite_code', code).maybeSingle();
  if (!group) throw new NotFoundError('Group with that code');
  const { data: existing } = await db.from('chat_group_members').select('status').eq('group_id', group.id).eq('user_id', userId).maybeSingle();
  if (existing?.status === 'member') return { status: 'member' as const, groupId: group.id, name: group.name };
  if (!existing) {
    const open = group.require_approval === false;
    const { error } = await db.from('chat_group_members').insert({
      group_id: group.id, user_id: userId, role: 'member', status: open ? 'member' : 'pending',
      ...(open ? { joined_at: new Date().toISOString() } : {}),
    });
    if (error) throw new Error(`Failed to send request: ${error.message}`);
    if (open) return { status: 'member' as const, groupId: group.id, name: group.name };
  }
  return { status: 'pending' as const, groupId: group.id, name: group.name };
}

export async function getGroup(userId: string, groupId: string) {
  const auth = await authorize(`group:${groupId}`, userId);
  const db = getDatabase();
  const { data: group } = await db.from('chat_groups').select('*').eq('id', groupId).maybeSingle();
  if (!group) throw new NotFoundError('Group');
  const { data: rows } = await db.from('chat_group_members').select('user_id, role, status, joined_at').eq('group_id', groupId);
  const names = await nameMap((rows ?? []).map((r) => r.user_id));
  const members = (rows ?? []).filter((r) => r.status === 'member')
    .map((r) => ({ userId: r.user_id as string, name: names[r.user_id], role: r.role as string, you: r.user_id === userId }));
  const requests = auth.isLead
    ? (rows ?? []).filter((r) => r.status === 'pending').map((r) => ({ userId: r.user_id as string, name: names[r.user_id] }))
    : [];
  return {
    id: group.id as string, name: group.name as string, inviteCode: group.invite_code as string, isAdmin: auth.isLead, members, requests,
    description: (group.description as string) ?? '', region: (group.region as string) ?? '',
    requireApproval: group.require_approval !== false, membersCanEdit: !!group.members_can_edit, onlyAdminsPost: !!group.only_admins_post,
    canEdit: auth.isLead || !!group.members_can_edit,
  };
}

export async function respondToGroupRequest(adminId: string, groupId: string, memberId: string, action: 'accept' | 'decline') {
  const auth = await authorize(`group:${groupId}`, adminId);
  if (!auth.isLead) throw new ForbiddenError('Only the group admin can answer requests');
  const db = getDatabase();
  const q = db.from('chat_group_members');
  if (action === 'accept') {
    const { error } = await q.update({ status: 'member', joined_at: new Date().toISOString() })
      .eq('group_id', groupId).eq('user_id', memberId).eq('status', 'pending');
    if (error) throw new Error(error.message);
  } else {
    const { error } = await q.delete().eq('group_id', groupId).eq('user_id', memberId).eq('status', 'pending');
    if (error) throw new Error(error.message);
  }
  return { ok: true };
}

// ----------------------------- rename and group settings -----------------------------

/** Trip chats: any rider on the trip can rename the chat (the trip itself is not renamed). */
export async function renameTripChat(key: string, userId: string, rawName: string) {
  const auth = await authorize(key, userId);
  if (auth.type !== 'trip') throw new ValidationError('Not a trip chat');
  const name = rawName.trim();
  if (name.length < 2 || name.length > 100) throw new ValidationError('Name must be 2 to 100 characters');
  const { error } = await getDatabase().from('trips').update({ chat_name: name }).eq('id', auth.id);
  if (error) throw new Error(error.message);
  return { name };
}

export interface GroupSettingsPatch {
  name?: string; description?: string; region?: string;
  requireApproval?: boolean; membersCanEdit?: boolean; onlyAdminsPost?: boolean;
}

export async function updateGroupSettings(userId: string, groupId: string, patch: GroupSettingsPatch) {
  const auth = await authorize(`group:${groupId}`, userId);
  const db = getDatabase();
  const { data: group } = await db.from('chat_groups').select('members_can_edit').eq('id', groupId).maybeSingle();
  if (!group) throw new NotFoundError('Group');
  const canEdit = auth.isLead || !!group.members_can_edit;
  const update: Record<string, unknown> = {};

  if (patch.name !== undefined || patch.description !== undefined || patch.region !== undefined) {
    if (!canEdit) throw new ForbiddenError('Only admins can edit this group');
    if (patch.name !== undefined) {
      const n = patch.name.trim();
      if (n.length < 2 || n.length > 100) throw new ValidationError('Group name must be 2 to 100 characters');
      update.name = n;
    }
    if (patch.description !== undefined) update.description = patch.description.trim().slice(0, 500) || null;
    if (patch.region !== undefined) update.region = patch.region.trim().slice(0, 80) || null;
  }
  if (patch.requireApproval !== undefined || patch.membersCanEdit !== undefined || patch.onlyAdminsPost !== undefined) {
    if (!auth.isLead) throw new ForbiddenError('Only admins can change group settings');
    if (patch.requireApproval !== undefined) update.require_approval = patch.requireApproval;
    if (patch.membersCanEdit !== undefined) update.members_can_edit = patch.membersCanEdit;
    if (patch.onlyAdminsPost !== undefined) update.only_admins_post = patch.onlyAdminsPost;
  }
  if (Object.keys(update).length === 0) return { ok: true };
  const { error } = await db.from('chat_groups').update(update).eq('id', groupId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

async function adminCount(groupId: string): Promise<number> {
  const { count } = await getDatabase().from('chat_group_members')
    .select('user_id', { count: 'exact', head: true }).eq('group_id', groupId).eq('status', 'member').eq('role', 'admin');
  return count ?? 0;
}

export async function setMemberRole(adminId: string, groupId: string, memberId: string, role: 'admin' | 'member') {
  const auth = await authorize(`group:${groupId}`, adminId);
  if (!auth.isLead) throw new ForbiddenError('Only admins can change roles');
  if (role === 'member' && memberId === adminId && (await adminCount(groupId)) <= 1) {
    throw new ValidationError('Make someone else admin first');
  }
  const { error } = await getDatabase().from('chat_group_members').update({ role })
    .eq('group_id', groupId).eq('user_id', memberId).eq('status', 'member');
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function removeMember(adminId: string, groupId: string, memberId: string) {
  const auth = await authorize(`group:${groupId}`, adminId);
  if (!auth.isLead) throw new ForbiddenError('Only admins can remove members');
  if (memberId === adminId) throw new ValidationError('Use Leave group to leave');
  const { error } = await getDatabase().from('chat_group_members').delete().eq('group_id', groupId).eq('user_id', memberId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function leaveGroup(userId: string, groupId: string) {
  const auth = await authorize(`group:${groupId}`, userId);
  const db = getDatabase();
  if (auth.isLead && (await adminCount(groupId)) <= 1) {
    // Hand the group to the longest-standing member, or close it if nobody is left.
    const { data: others } = await db.from('chat_group_members').select('user_id, joined_at')
      .eq('group_id', groupId).eq('status', 'member').neq('user_id', userId).order('joined_at', { ascending: true }).limit(1);
    if (others && others.length > 0) {
      await db.from('chat_group_members').update({ role: 'admin' }).eq('group_id', groupId).eq('user_id', others[0].user_id);
    } else {
      await db.from('chat_group_members').delete().eq('group_id', groupId);
      await db.from('chat_groups').delete().eq('id', groupId);
      return { ok: true, closed: true };
    }
  }
  await db.from('chat_group_members').delete().eq('group_id', groupId).eq('user_id', userId);
  return { ok: true, closed: false };
}

export async function resetInviteCode(adminId: string, groupId: string) {
  const auth = await authorize(`group:${groupId}`, adminId);
  if (!auth.isLead) throw new ForbiddenError('Only admins can change the invite code');
  const db = getDatabase();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newInviteCode();
    const { error } = await db.from('chat_groups').update({ invite_code: code }).eq('id', groupId);
    if (error?.code === '23505') continue;
    if (error) throw new Error(error.message);
    return { inviteCode: code };
  }
  throw new Error('Could not create a unique invite code');
}

// ----------------------------- read and unread -----------------------------

export async function markConversation(userId: string, key: string, unread: boolean) {
  await authorize(key, userId);
  const { error } = await getDatabase().from('chat_reads').upsert(
    { user_id: userId, conversation_key: key, last_read_at: new Date().toISOString(), marked_unread: unread },
  );
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function markAllRead(userId: string) {
  const convs = await listConversations(userId);
  const now = new Date().toISOString();
  const rows = convs.filter((c) => c.unread > 0).map((c) => ({ user_id: userId, conversation_key: c.key, last_read_at: now, marked_unread: false }));
  if (rows.length) {
    const { error } = await getDatabase().from('chat_reads').upsert(rows);
    if (error) throw new Error(error.message);
  }
  return { cleared: rows.length };
}
