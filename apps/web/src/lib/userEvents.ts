import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { useAuth } from '../context/AuthContext';

/**
 * Pings from the server for the signed-in person ("a chat changed", "a ride started").
 * One shared realtime channel for the whole app. The ping holds no data: the screen that cares
 * asks the server once. While the channel is not connected, screens fall back to asking on a timer.
 */
export type UserEventName = 'chat' | 'ride';
type Handler = (event: UserEventName, payload: Record<string, unknown>) => void;
export type EventsStatus = 'connecting' | 'live' | 'down';

let channel: RealtimeChannel | null = null;
let channelUser: string | null = null;
let status: EventsStatus = 'connecting';
const handlers = new Set<Handler>();
const statusListeners = new Set<() => void>();

const setStatus = (s: EventsStatus) => {
  if (status === s) return;
  status = s;
  statusListeners.forEach((fn) => fn());
};

function open(userId: string) {
  if (channel && channelUser === userId) return;
  close();
  channelUser = userId;
  setStatus('connecting');
  const ch = supabase.channel(`user:${userId}`);
  (['chat', 'ride'] as UserEventName[]).forEach((ev) => {
    ch.on('broadcast', { event: ev }, (msg) => handlers.forEach((h) => h(ev, (msg.payload ?? {}) as Record<string, unknown>)));
  });
  ch.subscribe((s) => {
    if (s === 'SUBSCRIBED') setStatus('live');
    else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') setStatus('down');
  });
  channel = ch;
}

function close() {
  if (channel) void supabase.removeChannel(channel);
  channel = null;
  channelUser = null;
}

/** Subscribe a screen to pings. The channel opens with the first listener and closes with the last. */
function listen(userId: string, handler: Handler): () => void {
  handlers.add(handler);
  open(userId);
  return () => {
    handlers.delete(handler);
    if (handlers.size === 0) close();
  };
}

const subscribeStatus = (fn: () => void) => { statusListeners.add(fn); return () => { statusListeners.delete(fn); }; };

/**
 * Runs `load` now, whenever a matching ping arrives, when the app comes back to the front, and on a
 * timer that is slow while pings are live (`slowMs`) and fast when they are not (`fastMs`).
 * Nothing runs while the app is hidden.
 */
export function useLiveRefresh(
  load: () => void,
  opts: { events: UserEventName[]; slowMs: number; fastMs: number; match?: (payload: Record<string, unknown>) => boolean },
) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const loadRef = useRef(load);
  loadRef.current = load;
  const matchRef = useRef(opts.match);
  matchRef.current = opts.match;
  const eventsKey = opts.events.join(',');
  const live = useSyncExternalStore(subscribeStatus, () => status) === 'live';
  const ms = live ? opts.slowMs : opts.fastMs;

  // Pings and the first load. Not tied to the timer, so the channel is not reopened when the timer changes.
  useEffect(() => {
    if (!userId) return;
    const run = () => { if (document.visibilityState === 'visible') loadRef.current(); };
    const off = listen(userId, (ev, payload) => {
      if (eventsKey.split(',').includes(ev) && (!matchRef.current || matchRef.current(payload))) run();
    });
    run();
    document.addEventListener('visibilitychange', run);
    return () => { off(); document.removeEventListener('visibilitychange', run); };
  }, [userId, eventsKey]);

  // The safety timer: slow while pings are live, fast when they are not.
  useEffect(() => {
    if (!userId) return;
    const id = setInterval(() => { if (document.visibilityState === 'visible') loadRef.current(); }, ms);
    return () => clearInterval(id);
  }, [userId, ms]);
}
