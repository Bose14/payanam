import webpush from 'web-push';
import env from '../config/environment';
import { getDatabase } from '../config/database';

export const pushEnabled = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

if (pushEnabled) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
}

export interface PushPayload {
  title: string;
  body: string;
  /** Where the app should go when the notification is tapped. */
  url?: string;
  /** Same tag replaces the earlier notification instead of stacking. */
  tag?: string;
  urgent?: boolean;
}

export interface SubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export function getPublicKey(): string | null {
  return pushEnabled ? env.VAPID_PUBLIC_KEY! : null;
}

export async function saveSubscription(userId: string, sub: SubscriptionInput, userAgent?: string) {
  const { error } = await getDatabase().from('push_subscriptions').upsert(
    { user_id: userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, user_agent: userAgent ?? null },
    { onConflict: 'endpoint' },
  );
  if (error) throw new Error(error.message);
}

export async function removeSubscription(userId: string, endpoint: string) {
  await getDatabase().from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint);
}

/** Sends to every device the given users subscribed. Never throws; push is best effort. */
export async function sendPush(userIds: string[], payload: PushPayload): Promise<void> {
  if (!pushEnabled || userIds.length === 0) return;
  try {
    const db = getDatabase();
    const { data } = await db
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .in('user_id', [...new Set(userIds)]);
    const body = JSON.stringify(payload);
    await Promise.all(
      (data ?? []).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
            { TTL: payload.urgent ? 600 : 3600, urgency: payload.urgent ? 'high' : 'normal' },
          );
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) {
            await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
          }
        }
      }),
    );
  } catch {
    /* push must never break the request that triggered it */
  }
}
