import { chatService } from '../services/api';

/**
 * Keeps live locations shared in trip chats up to date. Lives at module level so it keeps
 * running while the rider moves between tabs. It stops when the time is up, when the rider
 * stops it, or when the app is closed.
 */
interface Share { key: string; messageId: string; until: number }

const STORE = 'payanam_live_shares';
const SEND_EVERY_MS = 15000;

let shares: Share[] = [];
let watchId: number | null = null;
let lastSent = 0;
const listeners = new Set<() => void>();

function persist() {
  try { localStorage.setItem(STORE, JSON.stringify(shares)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export function onLiveSharesChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function isSharingLive(messageId: string): boolean {
  return shares.some((s) => s.messageId === messageId && s.until > Date.now());
}

function prune() {
  const before = shares.length;
  shares = shares.filter((s) => s.until > Date.now());
  if (shares.length !== before) persist();
}

function ensureWatch() {
  if (watchId != null || !('geolocation' in navigator) || shares.length === 0) return;
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      prune();
      if (shares.length === 0) { stopWatch(); return; }
      if (Date.now() - lastSent < SEND_EVERY_MS) return;
      lastSent = Date.now();
      for (const s of [...shares]) {
        chatService.updateLive(s.key, s.messageId, pos.coords.latitude, pos.coords.longitude)
          .then((r) => { if (!r.active) stopLiveShare(s.messageId); })
          .catch(() => undefined);
      }
    },
    () => undefined,
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
  );
}

function stopWatch() {
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
}

export function startLiveShare(key: string, messageId: string, until: number) {
  shares = [...shares.filter((s) => s.messageId !== messageId), { key, messageId, until }];
  persist();
  lastSent = 0;
  ensureWatch();
}

export function stopLiveShare(messageId: string) {
  shares = shares.filter((s) => s.messageId !== messageId);
  persist();
  if (shares.length === 0) stopWatch();
}

/** Call on app start: carries on with any live shares that have not run out. */
export function resumeLiveShares() {
  try { shares = JSON.parse(localStorage.getItem(STORE) || '[]'); } catch { shares = []; }
  prune();
  ensureWatch();
}
