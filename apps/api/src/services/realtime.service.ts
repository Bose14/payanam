import env from '../config/environment';

/**
 * Tells people's open apps that something changed, so they ask the server once instead of
 * asking on a timer. Sends a small Supabase realtime broadcast to each person's own channel
 * ("user:<id>"). The message holds no content, only what to look at again.
 */
export type UserEvent = 'chat' | 'ride';

const MAX_PER_CALL = 100;

export async function broadcastToUsers(userIds: string[], event: UserEvent, payload: Record<string, unknown> = {}): Promise<void> {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (ids.length === 0) return;
  try {
    for (let i = 0; i < ids.length; i += MAX_PER_CALL) {
      const messages = ids.slice(i, i + MAX_PER_CALL).map((id) => ({ topic: `user:${id}`, event, payload, private: false }));
      const res = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/realtime/v1/api/broadcast`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ messages }),
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) console.warn(`[realtime] broadcast failed: ${res.status}`);
    }
  } catch (e) {
    // Never blocks or fails the request that caused it. Open apps still refresh on a slower timer.
    console.warn(`[realtime] broadcast error: ${(e as Error).message}`);
  }
}
