import fs from 'fs';
import path from 'path';

export interface LocalRoomRequest {
  id: string;
  room_id: string;
  trip_id: string;
  user_id: string;
  role: 'member' | 'owner';
  status: 'pending' | 'approved' | 'rejected';
  joined_at: string;
  users?: {
    full_name: string;
    email: string;
    avatar_url?: string | null;
  } | null;
}

function getDataDir(): string {
  const candidate1 = path.resolve(process.cwd(), 'apps/api/data');
  if (fs.existsSync(candidate1)) return candidate1;

  const candidate2 = path.resolve(process.cwd(), 'data');
  if (fs.existsSync(candidate2)) return candidate2;

  const candidate3 = path.resolve(__dirname, '../../data');
  if (fs.existsSync(candidate3)) return candidate3;

  // Fallback: prefer apps/api/data if in payanam root, else data
  const target = fs.existsSync(path.resolve(process.cwd(), 'apps/api')) ? candidate1 : candidate2;
  try {
    fs.mkdirSync(target, { recursive: true });
  } catch { /* silent */ }
  return target;
}

const REQUESTS_FILE = path.join(getDataDir(), 'room_requests.json');

export function readLocalRequests(): Record<string, LocalRoomRequest> {
  try {
    if (fs.existsSync(REQUESTS_FILE)) {
      const raw = fs.readFileSync(REQUESTS_FILE, 'utf-8');
      return JSON.parse(raw) || {};
    }
  } catch (err) {
    console.warn('[roomRequest.service] readLocalRequests failed:', err);
  }
  return {};
}

export function writeLocalRequest(req: LocalRoomRequest): void {
  try {
    const all = readLocalRequests();
    all[req.id] = req;
    fs.writeFileSync(REQUESTS_FILE, JSON.stringify(all, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[roomRequest.service] writeLocalRequest failed:', err);
  }
}

export function getLocalRequestByRoomAndUser(roomId: string, userId: string): LocalRoomRequest | undefined {
  const all = readLocalRequests();
  return Object.values(all).find((r) => r.room_id === roomId && r.user_id === userId);
}

export function getLocalRequestsForRoom(roomId: string): LocalRoomRequest[] {
  const all = readLocalRequests();
  return Object.values(all).filter((r) => r.room_id === roomId);
}

export function updateLocalRequestStatus(identifier: string, status: 'pending' | 'approved' | 'rejected'): boolean {
  try {
    const all = readLocalRequests();
    let target: LocalRoomRequest | undefined = all[identifier];
    if (!target) {
      // Maybe identifier was user_id or room_id
      target = Object.values(all).find((r) => r.id === identifier || r.user_id === identifier);
    }
    if (target) {
      target.status = status;
      all[target.id] = target;
      fs.writeFileSync(REQUESTS_FILE, JSON.stringify(all, null, 2), 'utf-8');
      return true;
    }
  } catch (err) {
    console.warn('[roomRequest.service] updateLocalRequestStatus failed:', err);
  }
  return false;
}
