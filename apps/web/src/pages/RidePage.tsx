import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { rideService } from '../services/api';
import { useAuth } from '../context/AuthContext';

const RIDER_COLORS = ['#ef4444','#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#84cc16'];
const QUICK_STATUS_OPTIONS = [
  { label: '✅ All Good', value: '✅ All Good' },
  { label: '⛽ Need Fuel', value: '⛽ Need Fuel' },
  { label: '☕ Taking a Break', value: '☕ Taking a Break' },
  { label: '🚨 Flat Tyre', value: '🚨 Flat Tyre' },
  { label: '🔧 Bike Issue', value: '🔧 Bike Issue' },
  { label: '🏁 Clear Status', value: '' },
];

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function makeRiderIcon(initial: string, color: string, isMe: boolean, status: string) {
  const size = isMe ? 44 : 36;
  const ring = isMe ? `box-shadow:0 0 0 3px ${color},0 0 0 6px ${color}44;` : '';
  const badge = status ? `<div style="position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#1f2937;color:#fff;font-size:10px;padding:2px 6px;border-radius:8px;font-weight:600;">${status}</div>` : '';
  return L.divIcon({
    className: '',
    iconAnchor: [size / 2, size / 2],
    iconSize: [size, size + (status ? 22 : 0)],
    html: `<div style="position:relative;width:${size}px;height:${size}px;background:${color};border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:${isMe ? 18 : 15}px;border:2px solid #fff;${ring}">${initial}${badge}</div>`,
  });
}

function makeStopIcon() {
  return L.divIcon({
    className: '',
    iconAnchor: [6, 6],
    iconSize: [12, 12],
    html: `<div style="width:12px;height:12px;background:#9ca3af;border-radius:50%;border:2px solid #fff;"></div>`,
  });
}

interface RiderLocation {
  user_id: string; user_name: string; lat: number; lng: number;
  speed_kmh: number; heading?: number; quick_status: string; updated_at: string;
}

interface RideMessage {
  id: string; user_id: string; user_name: string;
  message: string; message_type: string; created_at: string;
}

interface ItineraryStop {
  id: string; place: string; lat: number | null; lng: number | null;
  day_number: number; order_index: number;
}

interface Session {
  id: string; trip_id: string; started_by: string; status: string;
  trips: { id: string; title: string; from_place: string; to_place: string };
  itinerary: ItineraryStop[];
}

// Continuously follows user position; stops following when user drags map
function MapFollow({ lat, lng, following, onDrag }: { lat: number; lng: number; following: boolean; onDrag: () => void }) {
  const map = useMap();
  const onDragRef = useRef(onDrag);
  onDragRef.current = onDrag;

  useEffect(() => {
    if (following) {
      map.setView([lat, lng], Math.max(map.getZoom(), 16), { animate: true, duration: 0.6, easeLinearity: 0.4 });
    }
  }, [lat, lng, following, map]);

  useEffect(() => {
    const handler = () => onDragRef.current();
    map.on('dragstart', handler);
    return () => { map.off('dragstart', handler); };
  }, [map]);

  return null;
}

type TabType = 'map' | 'chat' | 'riders';

export default function RidePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [ended, setEnded] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [myLat, setMyLat] = useState<number | null>(null);
  const [myLng, setMyLng] = useState<number | null>(null);
  const [riders, setRiders] = useState<RiderLocation[]>([]);
  const [messages, setMessages] = useState<RideMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState<TabType>('map');
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [myStatus, setMyStatus] = useState('');
  const [sosActive, setSosActive] = useState(false);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const [following, setFollowing] = useState(true);
  const [endingRide, setEndingRide] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [backgroundWarning, setBackgroundWarning] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const dbSyncRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const myPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const userName = user?.fullName ?? user?.email ?? 'Rider';

  // Load session
  useEffect(() => {
    if (!sessionId) return;
    rideService.getSessionById(sessionId)
      .then((d) => {
        if (d.session.status !== 'active') { setEnded(true); }
        setSession(d.session);
      })
      .catch(() => setEnded(true))
      .finally(() => setLoading(false));
  }, [sessionId]);

  // Wake Lock + background visibility tracking
  useEffect(() => {
    if (!session || ended) return;

    const acquireWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          wakeLockRef.current = await (navigator as Navigator & { wakeLock: { request: (type: string) => Promise<WakeLockSentinel> } }).wakeLock.request('screen');
          setWakeLockActive(true);
          wakeLockRef.current.addEventListener('release', () => setWakeLockActive(false));
        } catch { /* denied or unsupported */ }
      }
    };

    acquireWakeLock();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Re-acquire wake lock (it auto-releases when screen locks)
        acquireWakeLock();
        setBackgroundWarning(false);
        // Re-broadcast current position immediately after coming back
        if (myPosRef.current && channelRef.current) {
          channelRef.current.send({
            type: 'broadcast', event: 'location',
            payload: { userId: user?.id, userName, lat: myPosRef.current.lat, lng: myPosRef.current.lng, speedKmh: 0, heading: 0, updatedAt: new Date().toISOString() },
          });
        }
      } else {
        setBackgroundWarning(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      wakeLockRef.current?.release().catch(() => {});
    };
  }, [session, ended, userName, user?.id]);

  // Start GPS watch — broadcast on every fix, DB upsert every 15s
  useEffect(() => {
    if (!sessionId || !session || ended) return;
    if (!navigator.geolocation) { setGpsError('GPS not supported on this device'); return; }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, speed, heading } = pos.coords;
        setMyLat(lat); setMyLng(lng);
        myPosRef.current = { lat, lng };
        const speedKmh = speed != null ? speed * 3.6 : 0;
        const hdg = heading ?? 0;
        // Instant broadcast — zero DB write, real-time for all riders
        channelRef.current?.send({
          type: 'broadcast', event: 'location',
          payload: { userId: user?.id, userName, lat, lng, speedKmh, heading: hdg, updatedAt: new Date().toISOString() },
        });
      },
      (err) => {
        if (err.code === 1) setGpsError('Location permission denied. Please enable GPS.');
        else setGpsError('Unable to get your location.');
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
    );

    // DB upsert every 15s — so late joiners see your last position
    dbSyncRef.current = setInterval(() => {
      if (myPosRef.current) {
        rideService.updateLocation(sessionId, { ...myPosRef.current, speedKmh: 0, userName }).catch(() => {});
      }
    }, 15000);

    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (dbSyncRef.current) clearInterval(dbSyncRef.current);
    };
  }, [session, ended, sessionId, userName, user?.id]);

  // Load initial state + subscribe to Broadcast channel
  useEffect(() => {
    if (!sessionId || !session || ended || !user) return;

    // One-time REST fetch: current rider positions + message history
    rideService.getAllLocations(sessionId).then((d) => setRiders(d.locations ?? [])).catch(() => {});
    rideService.getMessages(sessionId).then((d) => setMessages(d.messages ?? [])).catch(() => {});

    // Supabase Broadcast channel — real-time, no DB writes for locations
    const channel = supabase.channel(`ride:${sessionId}`, {
      config: { broadcast: { self: true } },
    });

    channel
      .on('broadcast', { event: 'location' }, ({ payload }) => {
        setRiders((prev) => {
          const idx = prev.findIndex((r) => r.user_id === payload.userId);
          const entry: RiderLocation = {
            user_id: payload.userId, user_name: payload.userName,
            lat: payload.lat, lng: payload.lng,
            speed_kmh: payload.speedKmh ?? 0, heading: payload.heading ?? 0,
            quick_status: payload.quickStatus ?? (idx >= 0 ? prev[idx].quick_status : ''),
            updated_at: payload.updatedAt,
          };
          if (idx >= 0) { const u = [...prev]; u[idx] = entry; return u; }
          return [...prev, entry];
        });
        if (payload.quickStatus?.includes('🆘')) setSosActive(true);
      })
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.id)) return prev; // dedup
          return [...prev, payload as RideMessage];
        });
        if (payload.message_type === 'sos') setSosActive(true);
        if (payload.message_type === 'chat') setNewMsgCount((c) => c + 1);
      })
      .on('broadcast', { event: 'status' }, ({ payload }) => {
        setRiders((prev) => prev.map((r) =>
          r.user_id === payload.userId ? { ...r, quick_status: payload.quickStatus } : r
        ));
      })
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); channelRef.current = null; };
  }, [session, ended, sessionId, user]);

  // Auto-scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Clear badge when opening chat
  useEffect(() => {
    if (tab === 'chat') setNewMsgCount(0);
  }, [tab]);

  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || !sessionId) return;
    setSending(true);
    try {
      const result = await rideService.sendMessage(sessionId, { message: chatInput.trim(), messageType: 'chat', userName });
      const msg = result?.message ?? { id: Date.now().toString(), user_id: user?.id, user_name: userName, message: chatInput.trim(), message_type: 'chat', created_at: new Date().toISOString() };
      // Broadcast so others see it instantly
      channelRef.current?.send({ type: 'broadcast', event: 'message', payload: msg });
      setChatInput('');
    } finally { setSending(false); }
  }, [chatInput, sessionId, userName, user?.id]);

  const sendSOS = useCallback(async () => {
    if (!sessionId) return;
    if (!window.confirm('🚨 Send SOS alert to all riders?')) return;
    const result = await rideService.sendMessage(sessionId, { message: '🆘 SOS! I need help! Check on me immediately.', messageType: 'sos', userName });
    const msg = result?.message ?? { id: Date.now().toString(), user_id: user?.id, user_name: userName, message: '🆘 SOS! I need help!', message_type: 'sos', created_at: new Date().toISOString() };
    channelRef.current?.send({ type: 'broadcast', event: 'message', payload: msg });
    await rideService.updateQuickStatus(sessionId, '🆘 SOS');
    channelRef.current?.send({ type: 'broadcast', event: 'status', payload: { userId: user?.id, userName, quickStatus: '🆘 SOS' } });
    setMyStatus('🆘 SOS');
  }, [sessionId, userName, user?.id]);

  const pickStatus = useCallback(async (value: string) => {
    if (!sessionId) return;
    setMyStatus(value);
    setShowStatusPicker(false);
    await rideService.updateQuickStatus(sessionId, value).catch(() => {});
    // Broadcast status change so others see rider dot badge update instantly
    channelRef.current?.send({ type: 'broadcast', event: 'status', payload: { userId: user?.id, userName, quickStatus: value } });
    if (value) {
      const result = await rideService.sendMessage(sessionId, { message: `Status update: ${value}`, messageType: 'status', userName }).catch(() => null);
      const msg = result?.message ?? { id: Date.now().toString(), user_id: user?.id, user_name: userName, message: `Status update: ${value}`, message_type: 'status', created_at: new Date().toISOString() };
      channelRef.current?.send({ type: 'broadcast', event: 'message', payload: msg });
    }
  }, [sessionId, userName, user?.id]);

  const handleEndRide = useCallback(async () => {
    if (!sessionId || !window.confirm('End the ride for everyone?')) return;
    setEndingRide(true);
    try {
      await rideService.endRide(sessionId);
      navigate(`/trips/${session?.trip_id}`, { replace: true });
    } finally { setEndingRide(false); }
  }, [sessionId, session, navigate]);

  const colorForUser = useCallback((uid: string) => {
    const allIds = [user?.id ?? '', ...riders.filter(r => r.user_id !== user?.id).map(r => r.user_id)];
    const idx = allIds.indexOf(uid);
    return RIDER_COLORS[idx >= 0 ? idx % RIDER_COLORS.length : 0];
  }, [riders, user]);

  const distanceTo = useCallback((lat: number, lng: number) => {
    if (!myPosRef.current) return null;
    return haversineKm(myPosRef.current.lat, myPosRef.current.lng, lat, lng);
  }, []);

  const itineraryStops = (session?.itinerary ?? []).filter((s) => s.lat && s.lng);
  const routeCoords: [number, number][] = itineraryStops.map((s) => [s.lat as number, s.lng as number]);
  const defaultCenter: [number, number] = myLat && myLng ? [myLat, myLng] : (routeCoords[0] ?? [20.5937, 78.9629]);

  if (loading) return (
    <div style={s.fullCenter}>
      <div style={{ fontSize: 40 }}>🏍️</div>
      <p style={{ color: '#fff', marginTop: 12 }}>Joining ride...</p>
    </div>
  );

  if (ended) return (
    <div style={s.fullCenter}>
      <div style={{ fontSize: 48 }}>🏁</div>
      <h2 style={{ color: '#fff', marginTop: 12 }}>Ride Ended</h2>
      <p style={{ color: '#9ca3af' }}>This ride session has ended.</p>
      <button onClick={() => navigate(-1)} style={s.btnWhite}>← Go Back</button>
    </div>
  );

  const isLead = session?.started_by === user?.id;

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#111827', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' }}>
      {/* SOS Banner */}
      {sosActive && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, background: '#dc2626', color: '#fff', padding: '12px 16px', textAlign: 'center', fontWeight: 700, fontSize: 15, animation: 'pulse 1s infinite' }}>
          🆘 SOS ALERT — A rider needs help! Check the Riders tab.
          <button onClick={() => setSosActive(false)} style={{ marginLeft: 12, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 6, padding: '2px 10px', cursor: 'pointer', fontWeight: 600 }}>Dismiss</button>
        </div>
      )}

      {/* Header */}
      <div style={{ background: '#1f2937', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0, marginTop: sosActive ? 48 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 18, cursor: 'pointer', padding: 0, flexShrink: 0 }}>←</button>
          <div style={{ minWidth: 0 }}>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: 14, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              🏍️ {session?.trips?.title ?? 'Live Ride'}
            </p>
            <p style={{ color: '#10b981', fontSize: 12, margin: 0, fontWeight: 600 }}>
              ● LIVE · {riders.length} rider{riders.length !== 1 ? 's' : ''}
              {!wakeLockActive && <span style={{ color: '#f59e0b', marginLeft: 8 }}>· Keep screen on</span>}
            </p>
          </div>
        </div>
        {isLead ? (
          <button onClick={handleEndRide} disabled={endingRide} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
            {endingRide ? '...' : '⏹ End Ride'}
          </button>
        ) : (
          <button onClick={() => navigate(-1)} style={{ background: '#374151', color: '#9ca3af', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
            Leave
          </button>
        )}
      </div>

      {/* Background warning banner */}
      {backgroundWarning && (
        <div style={{ background: '#92400e', color: '#fef3c7', padding: '8px 16px', fontSize: 13, fontWeight: 600, textAlign: 'center', flexShrink: 0 }}>
          ⚠️ App was in background — location may have paused. Keep this screen open while riding.
          <button onClick={() => setBackgroundWarning(false)} style={{ marginLeft: 10, background: 'none', border: 'none', color: '#fef3c7', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>✕</button>
        </div>
      )}

      {/* Map — always rendered, shown/hidden via visibility so Leaflet doesn't break */}
      <div style={{ flex: tab === 'map' ? 1 : 0, overflow: 'hidden', display: tab === 'map' ? 'block' : 'none', position: 'relative' }}>
        {gpsError && (
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 999, background: '#dc2626', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
            📍 {gpsError}
          </div>
        )}
        {/* Re-center button — appears when user pans away */}
        {!following && myLat && myLng && (
          <button
            onClick={() => setFollowing(true)}
            style={{ position: 'absolute', bottom: 80, right: 16, zIndex: 1000, background: '#1f2937', border: '2px solid #3b82f6', color: '#3b82f6', borderRadius: '50%', width: 48, height: 48, fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}
          >
            📍
          </button>
        )}
        {/* Wake lock indicator */}
        {wakeLockActive && (
          <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 999, background: 'rgba(16,185,129,0.9)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 8 }}>
            🔆 Screen on
          </div>
        )}
        <MapContainer center={defaultCenter} zoom={16} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap"
          />
          {myLat && myLng && (
            <MapFollow lat={myLat} lng={myLng} following={following} onDrag={() => setFollowing(false)} />
          )}
          {/* Route polyline */}
          {routeCoords.length > 1 && <Polyline positions={routeCoords} color="#3b82f6" weight={3} opacity={0.6} />}
          {/* Itinerary stop markers */}
          {itineraryStops.map((stop) => (
            <Marker key={stop.id} position={[stop.lat as number, stop.lng as number]} icon={makeStopIcon()} />
          ))}
          {/* Rider markers */}
          {riders.map((r) => (
            <Marker
              key={r.user_id}
              position={[Number(r.lat), Number(r.lng)]}
              icon={makeRiderIcon(
                (r.user_name || '?')[0].toUpperCase(),
                colorForUser(r.user_id),
                r.user_id === user?.id,
                r.quick_status ?? '',
              )}
            />
          ))}
        </MapContainer>
      </div>

      {/* Chat panel */}
      {tab === 'chat' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.length === 0 && <p style={{ color: '#6b7280', textAlign: 'center', marginTop: 40, fontSize: 14 }}>No messages yet. Say hi! 👋</p>}
            {messages.map((m) => {
              const isMe = m.user_id === user?.id;
              const isSos = m.message_type === 'sos';
              const isStatus = m.message_type === 'status';
              if (isStatus) return (
                <div key={m.id} style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: 12, color: '#6b7280', background: '#1f2937', padding: '3px 10px', borderRadius: 12 }}>
                    {m.user_name}: {m.message}
                  </span>
                </div>
              );
              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  {!isMe && <span style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>{m.user_name}</span>}
                  <div style={{
                    maxWidth: '75%', padding: '9px 14px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: isSos ? '#dc2626' : isMe ? '#3b82f6' : '#374151',
                    color: '#fff', fontSize: 14, fontWeight: isSos ? 700 : 400,
                    border: isSos ? '2px solid #fca5a5' : 'none',
                  }}>
                    {m.message}
                  </div>
                  <span style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
            <div ref={chatBottomRef} />
          </div>
          <div style={{ padding: '10px 12px', background: '#1f2937', display: 'flex', gap: 8, borderTop: '1px solid #374151' }}>
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendChat()}
              placeholder="Message the group..."
              style={{ flex: 1, background: '#374151', border: 'none', borderRadius: 20, padding: '10px 16px', color: '#fff', fontSize: 14, outline: 'none' }}
            />
            <button onClick={sendChat} disabled={sending || !chatInput.trim()} style={{ background: '#3b82f6', border: 'none', borderRadius: 20, padding: '10px 18px', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: sending || !chatInput.trim() ? 0.5 : 1 }}>
              ➤
            </button>
          </div>
        </div>
      )}

      {/* Riders panel */}
      {tab === 'riders' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {riders.length === 0 && <p style={{ color: '#6b7280', textAlign: 'center', marginTop: 40 }}>No riders online yet</p>}
          {riders.map((r, i) => {
            const dist = distanceTo(Number(r.lat), Number(r.lng));
            const secsAgo = Math.round((Date.now() - new Date(r.updated_at).getTime()) / 1000);
            const color = RIDER_COLORS[i % RIDER_COLORS.length];
            const isMe = r.user_id === user?.id;
            return (
              <div key={r.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#1f2937', borderRadius: 12, marginBottom: 8, border: isMe ? `1px solid ${color}` : '1px solid #374151' }}>
                <div style={{ width: 44, height: 44, background: color, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 18, flexShrink: 0 }}>
                  {(r.user_name || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: '#fff', fontWeight: 600, margin: 0, fontSize: 14 }}>
                    {r.user_name}{isMe ? ' (You)' : ''}
                  </p>
                  {r.quick_status && (
                    <p style={{ color: '#f59e0b', fontSize: 12, margin: '2px 0 0', fontWeight: 600 }}>{r.quick_status}</p>
                  )}
                  <p style={{ color: '#6b7280', fontSize: 12, margin: '2px 0 0' }}>
                    {r.speed_kmh > 0 ? `${Math.round(r.speed_kmh)} km/h · ` : ''}
                    {secsAgo < 10 ? 'just now' : `${secsAgo}s ago`}
                  </p>
                </div>
                {dist != null && !isMe && (
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ color: '#10b981', fontWeight: 700, fontSize: 15, margin: 0 }}>{dist.toFixed(1)} km</p>
                    <p style={{ color: '#6b7280', fontSize: 11, margin: 0 }}>away</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Quick status picker overlay */}
      {showStatusPicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500, display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowStatusPicker(false)}>
          <div style={{ background: '#1f2937', width: '100%', borderRadius: '16px 16px 0 0', padding: '20px 16px 32px' }} onClick={(e) => e.stopPropagation()}>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: 15, margin: '0 0 16px' }}>⚡ Quick Status</p>
            {QUICK_STATUS_OPTIONS.map((opt) => (
              <button key={opt.value} onClick={() => pickStatus(opt.value)} style={{ display: 'block', width: '100%', textAlign: 'left', background: myStatus === opt.value ? '#374151' : 'none', border: 'none', color: '#fff', fontSize: 15, padding: '12px 16px', cursor: 'pointer', borderRadius: 8, marginBottom: 4 }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <div style={{ background: '#1f2937', borderTop: '1px solid #374151', display: 'flex', flexShrink: 0 }}>
        <button onClick={sendSOS} style={{ flex: 1, padding: '14px 8px', background: '#dc2626', border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <span style={{ fontSize: 22 }}>🆘</span>SOS
        </button>
        <button onClick={() => setShowStatusPicker(true)} style={{ flex: 1, padding: '14px 8px', background: 'none', border: 'none', color: myStatus ? '#f59e0b' : '#9ca3af', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <span style={{ fontSize: 22 }}>⚡</span>{myStatus ? 'Status ●' : 'Status'}
        </button>
        <button onClick={() => setTab(tab === 'chat' ? 'map' : 'chat')} style={{ flex: 1, padding: '14px 8px', background: 'none', border: 'none', color: tab === 'chat' ? '#3b82f6' : '#9ca3af', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, position: 'relative' }}>
          <span style={{ fontSize: 22 }}>💬</span>
          Chat
          {newMsgCount > 0 && tab !== 'chat' && (
            <span style={{ position: 'absolute', top: 8, right: '20%', background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {newMsgCount > 9 ? '9+' : newMsgCount}
            </span>
          )}
        </button>
        <button onClick={() => setTab(tab === 'riders' ? 'map' : 'riders')} style={{ flex: 1, padding: '14px 8px', background: 'none', border: 'none', color: tab === 'riders' ? '#3b82f6' : '#9ca3af', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <span style={{ fontSize: 22 }}>👥</span>
          Riders
        </button>
        <button onClick={() => setTab('map')} style={{ flex: 1, padding: '14px 8px', background: 'none', border: 'none', color: tab === 'map' ? '#3b82f6' : '#9ca3af', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <span style={{ fontSize: 22 }}>🗺️</span>
          Map
        </button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  fullCenter: { height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#111827', gap: 8 },
  btnWhite: { marginTop: 16, padding: '10px 24px', background: '#fff', color: '#111827', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' },
};
