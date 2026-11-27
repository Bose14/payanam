import { useCallback, useEffect, useRef, useState } from 'react';
import { tripService } from '../../services/api';

interface TripRow {
  id: string;
  title: string;
  from_place: string;
  to_place: string;
  days: number;
  status: string;
  isOwner?: boolean;
  isJoined?: boolean;
  /** the live ride session, when one is running (sent by the server with the trip list) */
  activeSessionId?: string | null;
}

export interface TripWithSession extends TripRow {
  sessionId: string | null;
}

/** The user's trips, each with its live ride session id when one is running. One request. */
export function useTripSessions() {
  const [items, setItems] = useState<TripWithSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const busy = useRef(false);

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const data = await tripService.getUserTrips();
      const trips: TripRow[] = data?.trips ?? [];
      setItems(trips.map((t) => ({ ...t, sessionId: t.activeSessionId ?? null })));
      setError('');
    } catch {
      setError('Could not load your trips. Pull down or try again.');
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Loaded when the Ride tab opens, and again when the person returns to the app. No timer.
    void load();
    const onShow = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('focus', onShow);
    return () => { document.removeEventListener('visibilitychange', onShow); window.removeEventListener('focus', onShow); };
  }, [load]);

  return { items, loading, error, reload: load };
}
