import api from '../services/api';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Registers the worker, subscribes this device and tells the server. Safe to call repeatedly. */
export async function enablePush(): Promise<'subscribed' | 'unsupported' | 'unavailable' | 'denied'> {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission !== 'granted') return 'denied';
  try {
    const { data } = await api.get('/api/push/key');
    const { enabled, publicKey } = data.data as { enabled: boolean; publicKey: string | null };
    if (!enabled || !publicKey) return 'unavailable';
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }
    await api.post('/api/push/subscribe', { subscription: sub.toJSON() });
    return 'subscribed';
  } catch {
    return 'unavailable';
  }
}
