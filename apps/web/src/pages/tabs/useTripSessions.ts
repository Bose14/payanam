import { useCallback, useEffect, useState } from 'react';
import { rideService, tripService } from '../../services/api';

export interface TripRow {
  id: string;
  title: string;
  from_place: string;
  to_place: string;
  days: number;
  status: string;
  isOwner?: boolean;
  isJoined?: boolean;
}

export interface TripWithSession extends TripRow {
  sessionId: string | null;
}

/** The user's trips, each with its live ride session id when one is running. */
export function useTripSessions() {
  const [items, setItems] = useState<TripWithSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await tripService.getUserTrips();
      const trips: TripRow[] = data?.trips ?? [];
      const withSessions = await Promise.all(
        trips.map(async (t) => {
          try {
            const d = await rideService.getActiveSession(t.id);
            return { ...t, sessionId: (d?.session?.id as string | undefined) ?? null };
          } catch {
            return { ...t, sessionId: null };
          }
        }),
      );
      setItems(withSessions);
      setError('');
    } catch {
      setError('Could not load your trips. Pull down or try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  return { items, loading, error, reload: load };
}
