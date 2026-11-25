/** Remembers the ride a rider was in, so reopening the app can put them straight back. */
const KEY = 'payanam_resume_ride';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface ResumeRide { sessionId: string; tripId?: string; title?: string; at: number }

export function saveResumeRide(r: Omit<ResumeRide, 'at'>) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...r, at: Date.now() })); } catch { /* ignore */ }
}

export function getResumeRide(): ResumeRide | null {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || 'null') as ResumeRide | null;
    if (!r?.sessionId || Date.now() - r.at > MAX_AGE_MS) return null;
    return r;
  } catch { return null; }
}

export function clearResumeRide() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
