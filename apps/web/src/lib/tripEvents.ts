import { supabase } from './supabase';

/**
 * Tiny "something changed, look again" messages between the people on one trip, sent over the
 * Supabase realtime channel the app already uses. They carry no data: the receiver asks the
 * server, so access rules stay on the server. This replaces asking the server every few seconds.
 */
export type TripEvent = 'join-request' | 'join-response';

const channelName = (tripId: string) => `trip-events:${tripId}`;

export function notifyTrip(tripId: string, event: TripEvent): void {
  try {
    const ch = supabase.channel(channelName(tripId));
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void ch.send({ type: 'broadcast', event, payload: {} }).finally(() => { void supabase.removeChannel(ch); });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        void supabase.removeChannel(ch);
      }
    });
  } catch { /* the receiver still re-checks on a slow timer */ }
}

export function listenTrip(tripId: string, onEvent: (event: TripEvent) => void): () => void {
  const ch = supabase.channel(channelName(tripId));
  (['join-request', 'join-response'] as TripEvent[]).forEach((ev) => {
    ch.on('broadcast', { event: ev }, () => onEvent(ev));
  });
  ch.subscribe();
  return () => { void supabase.removeChannel(ch); };
}
