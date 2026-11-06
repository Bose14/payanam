import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { rideService, tripService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  NavigationAppModal,
  CaptainAnnouncementModal,
  QuickStatusDrawer,
  PinStopModal,
  StopArrivalTracker,
} from '../components';
import type { PinnedStopData } from '../components/PinStopModal';
import type { RiderArrivalInfo } from '../components/StopArrivalTracker';

const RIDER_COLORS = ['#ef4444','#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#84cc16'];

interface NavStep { instruction: string; distance: number; duration: number; }

function formatManeuver(maneuver: { type: string; modifier?: string }, name: string): string {
  const road = name ? ` on ${name}` : '';
  const { type, modifier: mod } = maneuver;
  if (type === 'depart') return `Depart${road}`;
  if (type === 'arrive') return 'Arrive at destination';
  if (type === 'turn') return `Turn ${mod ?? ''}${road}`;
  if (type === 'new name') return `Continue${road}`;
  if (type === 'merge') return `Merge${mod ? ' ' + mod : ''}${road}`;
  if (type === 'on ramp') return `Take ramp${road}`;
  if (type === 'off ramp') return `Take exit${road}`;
  if (type === 'fork') return `Keep ${mod ?? 'straight'}${road}`;
  if (type === 'roundabout') return `Enter roundabout${road}`;
  return `Continue${road}`;
}

function stepIcon(instr: string): string {
  const l = instr.toLowerCase();
  if (l.includes('arrive')) return '🏁';
  if (l.includes('depart')) return '🚦';
  if (l.includes('left')) return '↰';
  if (l.includes('right')) return '↱';
  if (l.includes('roundabout')) return '⟳';
  return '↑';
}

function fmtDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

async function geocodePlaceName(place: string): Promise<[number, number] | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place)}&format=json&limit=1&countrycodes=in`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'Payanam-App' } }
    );
    const data = await res.json();
    if (data?.[0]) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch { /* silent */ }
  return null;
}

async function fetchOsrmRoute(waypoints: [number, number][]): Promise<{ route: [number, number][]; steps: NavStep[] }> {
  if (waypoints.length < 2) return { route: waypoints, steps: [] };
  const coords = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(';');
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`);
    const data = await res.json();
    if (data.code === 'Ok' && data.routes?.[0]) {
      const r = data.routes[0];
      const route = (r.geometry.coordinates as [number, number][]).map(([lng, lat]) => [lat, lng] as [number, number]);
      const steps: NavStep[] = (r.legs as Array<{ steps: Array<{ maneuver: { type: string; modifier?: string }; name: string; distance: number; duration: number }> }>)
        .flatMap((leg) => leg.steps.map((s) => ({
          instruction: formatManeuver(s.maneuver, s.name),
          distance: s.distance,
          duration: s.duration,
        })));
      return { route, steps };
    }
  } catch { /* fallback */ }
  return { route: waypoints, steps: [] };
}
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Navigation arrow for the current user — rotates with heading
function makeMyNavIcon(color: string, heading: number, status: string) {
  const badge = status ? `<div style="position:absolute;bottom:-20px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#1f2937;color:#fff;font-size:10px;padding:2px 6px;border-radius:8px;font-weight:600;">${status}</div>` : '';
  return L.divIcon({
    className: '',
    iconAnchor: [24, 24],
    iconSize: [48, 48 + (status ? 24 : 0)],
    html: `<div style="position:relative;width:48px;height:48px;display:flex;align-items:center;justify-content:center;">
      <div style="transform:rotate(${heading}deg);width:48px;height:48px;display:flex;align-items:center;justify-content:center;">
        <svg width="44" height="44" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="20" fill="${color}" stroke="white" stroke-width="2.5" opacity="0.25"/>
          <polygon points="22,4 34,38 22,30 10,38" fill="${color}" stroke="white" stroke-width="2"/>
          <circle cx="22" cy="22" r="5" fill="white"/>
        </svg>
      </div>
      ${badge}
    </div>`,
  });
}

// Circle icon for other riders
function makeRiderIcon(initial: string, color: string, status: string) {
  const badge = status ? `<div style="position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#1f2937;color:#fff;font-size:10px;padding:2px 6px;border-radius:8px;font-weight:600;">${status}</div>` : '';
  return L.divIcon({
    className: '',
    iconAnchor: [18, 18],
    iconSize: [36, 36 + (status ? 22 : 0)],
    html: `<div style="position:relative;width:36px;height:36px;background:${color};border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:15px;border:2px solid #fff;">${initial}${badge}</div>`,
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

function makePinnedStopIcon(type: string) {
  const icon = type === 'fuel_stop' ? '⛽' : type === 'meal' ? '🍽️' : type === 'rest' ? '☕' : '📍';
  return L.divIcon({
    className: '',
    iconAnchor: [20, 20],
    iconSize: [40, 40],
    html: `<div style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;inset:0;background:#f59e0b;opacity:0.35;border-radius:50%;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
      <div style="width:34px;height:34px;background:#f59e0b;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 10px rgba(0,0,0,0.5);">
        ${icon}
      </div>
    </div>`,
  });
}

function playAlertChime(type: 'urgent' | 'chime' = 'chime') {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type === 'urgent' ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(type === 'urgent' ? 784 : 587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(type === 'urgent' ? 880 : 880, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch { /* silent */ }
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
  day_number: number; order_index: number; item_type?: string; description?: string;
}

interface Session {
  id: string; trip_id: string; started_by: string; status: string;
  trips: {
    id: string; title: string; from_place: string; to_place: string;
    from_lat?: number | null; from_lng?: number | null;
    to_lat?: number | null; to_lng?: number | null;
  };
  itinerary: ItineraryStop[];
}

// Continuously follows user position; stops following when user drags map
function MapFollow({ lat, lng, following, onDrag }: { lat: number; lng: number; following: boolean; onDrag: () => void }) {
  const map = useMap();
  const onDragRef = useRef(onDrag);
  onDragRef.current = onDrag;

  useEffect(() => {
    if (following) {
      map.setView([lat, lng], Math.max(map.getZoom(), 17), { animate: true, duration: 0.6, easeLinearity: 0.4 });
    }
  }, [lat, lng, following, map]);

  useEffect(() => {
    const handler = () => onDragRef.current();
    map.on('dragstart', handler);
    return () => { map.off('dragstart', handler); };
  }, [map]);

  return null;
}

type TabType = 'map' | 'chat' | 'riders' | 'nav';

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
  const [showStatusDrawer, setShowStatusDrawer] = useState(false);
  const [myStatus, setMyStatus] = useState('');
  const [sosActive, setSosActive] = useState(false);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const [following, setFollowing] = useState(true);
  const [myHeading, setMyHeading] = useState(0);
  const [osrmRoute, setOsrmRoute] = useState<[number, number][]>([]);
  const [navSteps, setNavSteps] = useState<NavStep[]>([]);
  const [endingRide, setEndingRide] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [backgroundWarning, setBackgroundWarning] = useState(false);

  // High Priority Stops & Communication State
  const [pinnedStop, setPinnedStop] = useState<PinnedStopData | null>(null);
  const [ridersArrival, setRidersArrival] = useState<Record<string, RiderArrivalInfo>>({});
  const [showPinModal, setShowPinModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [activeAnnouncement, setActiveAnnouncement] = useState<{
    title: string;
    message: string;
    icon: string;
    urgency: string;
    timestamp: string;
  } | null>(null);
  const [navTarget, setNavTarget] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [showNavModal, setShowNavModal] = useState(false);
  const [toast, setToast] = useState('');

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

  // Fetch road-following route: GPS position → itinerary stops → destination
  // Runs once when session + first GPS fix are both ready; refreshes every 2 min
  const routeFetchedRef = useRef(false);
  useEffect(() => {
    if (!session) return;

    const buildRoute = async () => {
      const pos = myPosRef.current;
      if (!pos) return; // GPS not ready yet
      const { trips } = session;
      const stopCoords: [number, number][] = (session.itinerary ?? [])
        .filter((s) => s.lat && s.lng)
        .map((s) => [s.lat as number, s.lng as number]);

      let destination: [number, number] | null = null;
      if (trips.to_lat && trips.to_lng) {
        destination = [trips.to_lat, trips.to_lng];
      } else {
        destination = await geocodePlaceName(trips.to_place);
      }

      const waypoints: [number, number][] = [
        [pos.lat, pos.lng],
        ...stopCoords,
        ...(destination ? [destination] : []),
      ];
      if (waypoints.length < 2) return;

      const { route, steps } = await fetchOsrmRoute(waypoints);
      setOsrmRoute(route);
      setNavSteps(steps);
      routeFetchedRef.current = true;
    };

    // Initial fetch — wait up to 10s for GPS
    const timer = setTimeout(buildRoute, 2000);
    // Refresh every 2 min so route updates as you progress
    const interval = setInterval(buildRoute, 120_000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [session]);

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
        if (heading != null) setMyHeading(heading);

        // Auto-arrival detection when within 250m of pinned stop
        if (pinnedStop) {
          const distKm = haversineKm(lat, lng, pinnedStop.lat, pinnedStop.lng);
          if (distKm < 0.25 && user?.id && ridersArrival[user.id]?.status !== 'arrived') {
            handleToggleMyArrival(true);
          }
        }
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
    rideService.getMessages(sessionId).then((d) => {
      const msgs = d.messages ?? [];
      setMessages(msgs);
      // Restore latest pinned stop from message history
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        if (m.message_type === 'stop_pin') {
          try {
            if (m.message.startsWith('{')) {
              const parsed = JSON.parse(m.message);
              if (parsed.stop) setPinnedStop(parsed.stop);
            } else if (m.message.includes('📍 Pinned Target Stop:')) {
              const stopName = m.message.replace('📍 Pinned Target Stop:', '').trim();
              const foundInItin = (session?.itinerary ?? []).find(s => s.place === stopName && s.lat && s.lng);
              if (foundInItin) {
                setPinnedStop({
                  id: foundInItin.id,
                  name: foundInItin.place,
                  lat: foundInItin.lat!,
                  lng: foundInItin.lng!,
                  type: 'stop',
                });
              }
            }
          } catch { /* silent */ }
          break;
        }
      }
    }).catch(() => {});

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
      .on('broadcast', { event: 'stop_pin' }, ({ payload }) => {
        setPinnedStop(payload.stop);
        setRidersArrival({});
        if (payload.stop) {
          playAlertChime('chime');
          setToast(`📍 Convoy Target Stop: ${payload.stop.name}`);
          setTimeout(() => setToast(''), 3500);
        }
      })
      .on('broadcast', { event: 'stop_arrival' }, ({ payload }) => {
        setRidersArrival((prev) => ({
          ...prev,
          [payload.userId]: {
            userId: payload.userId,
            userName: payload.userName,
            status: payload.status,
            arrivedAt: payload.arrivedAt,
            distanceKm: payload.distanceKm,
          },
        }));
        if (payload.status === 'arrived') {
          playAlertChime('chime');
          setToast(`🏁 ${payload.userName} arrived at stop!`);
          setTimeout(() => setToast(''), 3500);
        }
      })
      .on('broadcast', { event: 'announcement' }, ({ payload }) => {
        setActiveAnnouncement(payload);
        playAlertChime('urgent');
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
    setShowStatusDrawer(false);
    await rideService.updateQuickStatus(sessionId, value).catch(() => {});
    // Broadcast status change so others see rider dot badge update instantly
    channelRef.current?.send({ type: 'broadcast', event: 'status', payload: { userId: user?.id, userName, quickStatus: value } });
    if (value) {
      const result = await rideService.sendMessage(sessionId, { message: `Status update: ${value}`, messageType: 'status', userName }).catch(() => null);
      const msg = result?.message ?? { id: Date.now().toString(), user_id: user?.id, user_name: userName, message: `Status update: ${value}`, message_type: 'status', created_at: new Date().toISOString() };
      channelRef.current?.send({ type: 'broadcast', event: 'message', payload: msg });
    }
  }, [sessionId, userName, user?.id]);

  const handlePinStop = useCallback(async (stop: PinnedStopData, addToItinerary?: boolean) => {
    if (!sessionId || !session) return;
    setPinnedStop(stop);
    setRidersArrival({});
    playAlertChime('chime');
    setToast(`📍 Convoy Target Stop: ${stop.name}`);
    setTimeout(() => setToast(''), 3500);

    // If user asked to add to itinerary permanently
    if (addToItinerary && session.trip_id) {
      try {
        await tripService.addStop(session.trip_id, {
          place: stop.name,
          item_type: stop.type,
          description: stop.description || 'Pinned during live ride',
          lat: stop.lat,
          lng: stop.lng,
        });
        setToast(`✓ Added ${stop.name} to trip itinerary!`);
        setTimeout(() => setToast(''), 3500);
      } catch (err) {
        console.warn('Failed to add stop to itinerary:', err);
      }
    }

    // Broadcast to real-time channel
    channelRef.current?.send({
      type: 'broadcast',
      event: 'stop_pin',
      payload: { stop, pinnedBy: userName },
    });

    // Also persist as a ride message
    await rideService.sendMessage(sessionId, {
      message: `📍 Pinned Target Stop: ${stop.name}`,
      messageType: 'stop_pin',
      userName,
    }).catch(() => null);
  }, [sessionId, session, userName]);

  const handleClearPin = useCallback(async () => {
    if (!sessionId) return;
    setPinnedStop(null);
    setRidersArrival({});
    channelRef.current?.send({
      type: 'broadcast',
      event: 'stop_pin',
      payload: { stop: null, pinnedBy: userName },
    });
    setToast('Target stop cleared');
    setTimeout(() => setToast(''), 2500);
  }, [sessionId, userName]);

  const handleToggleMyArrival = useCallback(async (isArrived: boolean) => {
    if (!sessionId || !user || !pinnedStop) return;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const distKm = myPosRef.current ? haversineKm(myPosRef.current.lat, myPosRef.current.lng, pinnedStop.lat, pinnedStop.lng) : undefined;
    const arrivalPayload: RiderArrivalInfo = {
      userId: user.id,
      userName,
      status: isArrived ? 'arrived' : 'en_route',
      arrivedAt: isArrived ? timeStr : undefined,
      distanceKm: distKm,
    };

    setRidersArrival((prev) => ({ ...prev, [user.id]: arrivalPayload }));

    channelRef.current?.send({
      type: 'broadcast',
      event: 'stop_arrival',
      payload: { ...arrivalPayload, stopName: pinnedStop.name },
    });

    if (isArrived) {
      playAlertChime('chime');
      setToast(`🏁 Marked as arrived at ${pinnedStop.name}!`);
      setTimeout(() => setToast(''), 3500);
      await rideService.sendMessage(sessionId, {
        message: `🏁 I have arrived at ${pinnedStop.name}!`,
        messageType: 'stop_arrival',
        userName,
      }).catch(() => null);
    }
  }, [sessionId, user, userName, pinnedStop]);

  const handleSendAnnouncement = useCallback(async (announcement: {
    title: string;
    message: string;
    urgency: string;
    icon: string;
  }) => {
    if (!sessionId) return;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const payload = { ...announcement, timestamp: timeStr, senderName: userName };

    setActiveAnnouncement(payload);
    playAlertChime('urgent');

    channelRef.current?.send({
      type: 'broadcast',
      event: 'announcement',
      payload,
    });

    await rideService.sendMessage(sessionId, {
      message: `${announcement.icon} ${announcement.title}: ${announcement.message}`,
      messageType: 'announcement',
      userName,
    }).catch(() => null);

    setToast(`📢 Announcement broadcasted to all riders!`);
    setTimeout(() => setToast(''), 3500);
  }, [sessionId, userName]);

  const handleShareCurrentLocation = useCallback(async () => {
    if (!myLat || !myLng || !sessionId) {
      setToast('GPS position not ready yet.');
      setTimeout(() => setToast(''), 2500);
      return;
    }
    const locName = `Location (${myLat.toFixed(4)}, ${myLng.toFixed(4)})`;
    const content = `📍 Shared Location: ${locName} [${myLat.toFixed(6)},${myLng.toFixed(6)}]`;
    const result = await rideService.sendMessage(sessionId, {
      message: content,
      messageType: 'location_share',
      userName,
    }).catch(() => null);

    const msg: RideMessage = result?.message ?? {
      id: Date.now().toString(),
      user_id: user?.id || '',
      user_name: userName,
      message: content,
      message_type: 'location_share',
      created_at: new Date().toISOString(),
    };

    channelRef.current?.send({ type: 'broadcast', event: 'message', payload: msg });
    setMessages((prev) => [...prev, msg]);
    setToast('📍 Location shared with convoy!');
    setTimeout(() => setToast(''), 2500);
  }, [myLat, myLng, sessionId, userName, user?.id]);

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
      <div style={{ background: '#1f2937', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0, marginTop: sosActive ? 48 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 18, cursor: 'pointer', padding: 0, flexShrink: 0 }}>←</button>
          <div style={{ minWidth: 0 }}>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: 14, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              🏍️ {session?.trips?.title ?? 'Live Ride'}
            </p>
            <p style={{ color: '#10b981', fontSize: 11, margin: 0, fontWeight: 600 }}>
              ● LIVE · {riders.length} rider{riders.length !== 1 ? 's' : ''}
              {!wakeLockActive && <span style={{ color: '#f59e0b', marginLeft: 6 }}>· Screen on</span>}
            </p>
          </div>
        </div>

        {/* Quick actions for Captain & Riders */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setShowPinModal(true)}
            style={{
              background: pinnedStop ? 'rgba(245, 158, 11, 0.2)' : '#374151',
              border: pinnedStop ? '1px solid #f59e0b' : '1px solid #4b5563',
              color: pinnedStop ? '#fbbf24' : '#fff',
              borderRadius: 8,
              padding: '6px 10px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Set convoy regroup target stop"
          >
            <span>{pinnedStop ? '📍 Target' : '📌 Pin Stop'}</span>
          </button>

          {isLead && (
            <button
              type="button"
              onClick={() => setShowAnnouncementModal(true)}
              style={{
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                border: 'none',
                color: '#111827',
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              title="Broadcast alert to all riders"
            >
              <span>📢 Broadcast</span>
            </button>
          )}

          {isLead ? (
            <button onClick={handleEndRide} disabled={endingRide} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
              {endingRide ? '...' : '⏹ End'}
            </button>
          ) : (
            <button onClick={() => navigate(-1)} style={{ background: '#374151', color: '#9ca3af', border: 'none', borderRadius: 8, padding: '7px 11px', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
              Leave
            </button>
          )}
        </div>
      </div>

      {/* Floating HUD Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: 60,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          background: 'rgba(17, 24, 39, 0.95)',
          border: '1px solid #f59e0b',
          color: '#fff',
          padding: '8px 16px',
          borderRadius: 20,
          fontSize: 13,
          fontWeight: 700,
          boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
          animation: 'fadeIn 0.2s ease-out',
          whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}

      {/* Captain Announcement Top Banner */}
      {activeAnnouncement && (
        <div style={{
          background: activeAnnouncement.urgency === 'high' ? 'linear-gradient(135deg, #991b1b, #b91c1c)' : 'linear-gradient(135deg, #b45309, #d97706)',
          color: '#fff',
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
          borderBottom: '2px solid rgba(255,255,255,0.2)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>{activeAnnouncement.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: '#fef08a' }}>
              📢 CAPTAIN ANNOUNCEMENT ({activeAnnouncement.timestamp})
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeAnnouncement.title}: {activeAnnouncement.message}
            </div>
          </div>
          <button
            onClick={() => setActiveAnnouncement(null)}
            style={{
              background: 'rgba(255,255,255,0.25)',
              border: 'none',
              color: '#fff',
              borderRadius: 6,
              padding: '3px 8px',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Stop Arrival & ETA Tracker Bar */}
      {pinnedStop && (
        <StopArrivalTracker
          pinnedStop={pinnedStop}
          ridersArrival={ridersArrival}
          currentUserId={user?.id}
          myDistanceKm={myLat && myLng ? haversineKm(myLat, myLng, pinnedStop.lat, pinnedStop.lng) : null}
          mySpeedKmh={myPosRef.current ? 0 : 0}
          onToggleMyArrival={handleToggleMyArrival}
          onOpenNavigation={(target) => {
            setNavTarget(target);
            setShowNavModal(true);
          }}
          onChangePin={() => setShowPinModal(true)}
          onClearPin={handleClearPin}
          isLeader={isLead}
        />
      )}

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
        <MapContainer center={defaultCenter} zoom={18} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap"
          />
          {myLat && myLng && (
            <MapFollow lat={myLat} lng={myLng} following={following} onDrag={() => setFollowing(false)} />
          )}
          {/* Road-following route (OSRM), fallback to straight lines */}
          {(osrmRoute.length > 1 ? osrmRoute : routeCoords).length > 1 && (
            <Polyline positions={osrmRoute.length > 1 ? osrmRoute : routeCoords} color="#3b82f6" weight={5} opacity={0.85} />
          )}
          {/* Itinerary stop markers */}
          {itineraryStops.map((stop) => (
            <Marker key={stop.id} position={[stop.lat as number, stop.lng as number]} icon={makeStopIcon()} />
          ))}
          {/* Pinned target stop marker with pulsating alert */}
          {pinnedStop && (
            <Marker
              position={[pinnedStop.lat, pinnedStop.lng]}
              icon={makePinnedStopIcon(pinnedStop.type)}
            />
          )}
          {/* My navigation arrow — rotates with heading */}
          {riders.filter((r) => r.user_id === user?.id).map((r) => (
            <Marker
              key={r.user_id}
              position={[Number(r.lat), Number(r.lng)]}
              icon={makeMyNavIcon(colorForUser(r.user_id), myHeading, myStatus)}
            />
          ))}
          {/* Other riders — circle with initial */}
          {riders.filter((r) => r.user_id !== user?.id).map((r) => (
            <Marker
              key={r.user_id}
              position={[Number(r.lat), Number(r.lng)]}
              icon={makeRiderIcon((r.user_name || '?')[0].toUpperCase(), colorForUser(r.user_id), r.quick_status ?? '')}
            />
          ))}
        </MapContainer>
      </div>

      {/* Chat panel */}
      {tab === 'chat' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.length === 0 && <p style={{ color: '#6b7280', textAlign: 'center', marginTop: 40, fontSize: 14 }}>No messages yet. Say hi or share a stop! 👋</p>}
            {messages.map((m) => {
              const isMe = m.user_id === user?.id;
              const isSos = m.message_type === 'sos';
              const isStatus = m.message_type === 'status';
              const isAnnouncement = m.message_type === 'announcement';
              const isStopPin = m.message_type === 'stop_pin';
              const isStopArrival = m.message_type === 'stop_arrival';
              const isLocationShare = m.message_type === 'location_share' || m.message.includes('[') && m.message.includes(']');

              if (isStatus || isStopArrival) {
                return (
                  <div key={m.id} style={{ textAlign: 'center', margin: '2px 0' }}>
                    <span style={{
                      fontSize: 12,
                      color: isStopArrival ? '#34d399' : '#9ca3af',
                      background: isStopArrival ? 'rgba(16, 185, 129, 0.15)' : '#1f2937',
                      border: isStopArrival ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #374151',
                      padding: '3px 12px',
                      borderRadius: 14,
                      fontWeight: 600,
                    }}>
                      {m.message}
                    </span>
                  </div>
                );
              }

              if (isAnnouncement) {
                return (
                  <div key={m.id} style={{
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(217, 119, 6, 0.15))',
                    border: '1px solid #f59e0b',
                    borderRadius: 12,
                    padding: '10px 14px',
                    margin: '4px 0',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase' }}>
                      <span>📢</span>
                      <span>Captain Broadcast · {m.user_name}</span>
                    </div>
                    <div style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginTop: 4 }}>
                      {m.message}
                    </div>
                  </div>
                );
              }

              // Check if message has location coordinates [lat,lng]
              const coordMatch = m.message.match(/\[([0-9.-]+),\s*([0-9.-]+)\]/);
              const hasCoords = !!coordMatch;
              const parsedLat = coordMatch ? parseFloat(coordMatch[1]) : 0;
              const parsedLng = coordMatch ? parseFloat(coordMatch[2]) : 0;

              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  {!isMe && <span style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2, fontWeight: 600 }}>{m.user_name}</span>}
                  <div style={{
                    maxWidth: '82%', padding: '10px 14px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: isSos ? '#dc2626' : isStopPin ? '#1e3a8a' : isMe ? '#2563eb' : '#374151',
                    color: '#fff', fontSize: 14, fontWeight: isSos ? 700 : 400,
                    border: isSos ? '2px solid #fca5a5' : isStopPin ? '1px solid #60a5fa' : 'none',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  }}>
                    <div>{m.message}</div>

                    {/* Interactive Actions for Location / Stop Messages */}
                    {(isLocationShare || hasCoords) && parsedLat !== 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setNavTarget({ name: `${m.user_name}'s Shared Location`, lat: parsedLat, lng: parsedLng });
                            setShowNavModal(true);
                          }}
                          style={styles.chatActionBtn}
                        >
                          🧭 Navigate
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePinStop({
                            name: `${m.user_name}'s Shared Stop`,
                            lat: parsedLat,
                            lng: parsedLng,
                            type: 'stop',
                          }, false)}
                          style={{ ...styles.chatActionBtn, background: '#f59e0b', color: '#111827' }}
                        >
                          📍 Pin Stop
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!session?.trip_id) return;
                            try {
                              await tripService.addStop(session.trip_id, {
                                place: `Stop shared by ${m.user_name}`,
                                item_type: 'stop',
                                lat: parsedLat,
                                lng: parsedLng,
                                description: m.message,
                              });
                              setToast('✓ Added to trip itinerary!');
                              setTimeout(() => setToast(''), 3000);
                            } catch {
                              setToast('Failed to add stop');
                              setTimeout(() => setToast(''), 2500);
                            }
                          }}
                          style={{ ...styles.chatActionBtn, background: '#10b981', color: '#fff' }}
                        >
                          ➕ Add to Plan
                        </button>
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
            <div ref={chatBottomRef} />
          </div>

          {/* Quick Chat Actions (Location Share & Stop Suggest) */}
          <div style={{ padding: '6px 12px', background: '#111827', display: 'flex', gap: 8, borderTop: '1px solid #374151', overflowX: 'auto' }}>
            <button
              type="button"
              onClick={handleShareCurrentLocation}
              style={styles.chatQuickPill}
            >
              📍 Share My GPS Location
            </button>
            <button
              type="button"
              onClick={() => setShowPinModal(true)}
              style={styles.chatQuickPill}
            >
              📌 Suggest / Pin Stop
            </button>
            {isLead && (
              <button
                type="button"
                onClick={() => setShowAnnouncementModal(true)}
                style={{ ...styles.chatQuickPill, borderColor: '#f59e0b', color: '#fbbf24' }}
              >
                📢 Broadcast Alert
              </button>
            )}
          </div>

          {/* Message Input */}
          <div style={{ padding: '8px 12px', background: '#1f2937', display: 'flex', gap: 8, borderTop: '1px solid #374151' }}>
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendChat()}
              placeholder="Message convoy or mention a stop..."
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

      {/* Nav / Directions panel */}
      {tab === 'nav' && (
        <div style={{ flex: 1, overflowY: 'auto', background: '#111827' }}>
          {/* Quick Launch External Navigation Apps */}
          <div style={{ padding: '12px 16px', background: '#1f2937', borderBottom: '1px solid #374151', display: 'flex', gap: 10 }}>
            <button
              onClick={() => {
                if (pinnedStop) {
                  setNavTarget({ name: pinnedStop.name, lat: pinnedStop.lat, lng: pinnedStop.lng });
                  setShowNavModal(true);
                } else if (session?.trips?.to_lat && session?.trips?.to_lng) {
                  setNavTarget({ name: session.trips.to_place, lat: session.trips.to_lat, lng: session.trips.to_lng });
                  setShowNavModal(true);
                } else if (itineraryStops[0]?.lat && itineraryStops[0]?.lng) {
                  setNavTarget({ name: itineraryStops[0].place, lat: itineraryStops[0].lat!, lng: itineraryStops[0].lng! });
                  setShowNavModal(true);
                } else {
                  setToast('Pin a stop or choose a waypoint to navigate');
                  setTimeout(() => setToast(''), 2500);
                }
              }}
              style={{
                flex: 1,
                padding: '12px 14px',
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontWeight: 800,
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
              }}
            >
              <span>🧭 Open in Google Maps (Bike Nav) / Apple / Waze</span>
            </button>
          </div>

          {/* Route summary bar */}
          {navSteps.length > 0 && (() => {
            const totalDist = navSteps.reduce((a, s) => a + s.distance, 0);
            const totalSecs = navSteps.reduce((a, s) => a + s.duration, 0);
            const hrs = Math.floor(totalSecs / 3600);
            const mins = Math.round((totalSecs % 3600) / 60);
            return (
              <div style={{ background: '#1f2937', padding: '12px 16px', borderBottom: '1px solid #374151', display: 'flex', gap: 24 }}>
                <div>
                  <p style={{ color: '#fff', fontWeight: 700, fontSize: 16, margin: 0 }}>{fmtDist(totalDist)}</p>
                  <p style={{ color: '#9ca3af', fontSize: 11, margin: 0 }}>total distance</p>
                </div>
                <div>
                  <p style={{ color: '#fff', fontWeight: 700, fontSize: 16, margin: 0 }}>{hrs > 0 ? `${hrs}h ${mins}m` : `${mins} min`}</p>
                  <p style={{ color: '#9ca3af', fontSize: 11, margin: 0 }}>est. riding time</p>
                </div>
                <div>
                  <p style={{ color: '#fff', fontWeight: 700, fontSize: 16, margin: 0 }}>{navSteps.length}</p>
                  <p style={{ color: '#9ca3af', fontSize: 11, margin: 0 }}>turns</p>
                </div>
              </div>
            );
          })()}
          {navSteps.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 16px' }}>
              <p style={{ fontSize: 32 }}>🗺️</p>
              <p style={{ color: '#9ca3af', fontSize: 14 }}>Fetching route directions…</p>
            </div>
          )}
          {navSteps.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', borderBottom: '1px solid #1f2937', background: i === 0 ? '#1e3a5f' : 'transparent' }}>
              <div style={{ width: 36, height: 36, background: '#1f2937', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                {stepIcon(step.instruction)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#fff', fontSize: 14, fontWeight: i === 0 ? 700 : 400, margin: 0 }}>{step.instruction}</p>
                <p style={{ color: '#6b7280', fontSize: 12, margin: '3px 0 0' }}>{fmtDist(step.distance)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom tab bar */}
      <div style={{ background: '#1f2937', borderTop: '1px solid #374151', display: 'flex', flexShrink: 0 }}>
        <button onClick={sendSOS} style={{ flex: 1, padding: '14px 8px', background: '#dc2626', border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <span style={{ fontSize: 22 }}>🆘</span>SOS
        </button>
        <button onClick={() => setShowStatusDrawer(true)} style={{ flex: 1, padding: '14px 8px', background: 'none', border: 'none', color: myStatus ? '#f59e0b' : '#9ca3af', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
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
        <button onClick={() => setTab(tab === 'nav' ? 'map' : 'nav')} style={{ flex: 1, padding: '14px 8px', background: 'none', border: 'none', color: tab === 'nav' ? '#3b82f6' : '#9ca3af', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, position: 'relative' }}>
          <span style={{ fontSize: 22 }}>🧭</span>
          Nav
          {navSteps.length > 0 && tab !== 'nav' && (
            <span style={{ position: 'absolute', top: 8, right: '18%', width: 7, height: 7, borderRadius: '50%', background: '#10b981' }} />
          )}
        </button>
        <button onClick={() => setTab('map')} style={{ flex: 1, padding: '14px 8px', background: 'none', border: 'none', color: tab === 'map' ? '#3b82f6' : '#9ca3af', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <span style={{ fontSize: 22 }}>🗺️</span>
          Map
        </button>
      </div>

      {/* One-Tap Rider Status Drawer */}
      <QuickStatusDrawer
        isOpen={showStatusDrawer}
        onClose={() => setShowStatusDrawer(false)}
        currentStatus={myStatus}
        onSelectStatus={pickStatus}
      />

      {/* Target Pin Stop Modal */}
      <PinStopModal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        plannedStops={session?.itinerary ?? []}
        currentGps={myLat && myLng ? { lat: myLat, lng: myLng } : null}
        onPinStop={handlePinStop}
      />

      {/* Captain Broadcast Announcement Modal */}
      <CaptainAnnouncementModal
        isOpen={showAnnouncementModal}
        onClose={() => setShowAnnouncementModal(false)}
        onSendAnnouncement={handleSendAnnouncement}
      />

      {/* External Navigation Launcher Modal (Google Maps / Apple Maps / Waze) */}
      <NavigationAppModal
        isOpen={showNavModal}
        onClose={() => setShowNavModal(false)}
        target={navTarget}
      />
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  fullCenter: { height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#111827', gap: 8 },
  btnWhite: { marginTop: 16, padding: '10px 24px', background: '#fff', color: '#111827', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' },
};

const styles: Record<string, React.CSSProperties> = {
  chatActionBtn: {
    padding: '4px 8px',
    background: '#374151',
    border: 'none',
    borderRadius: 6,
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  },
  chatQuickPill: {
    padding: '6px 12px',
    background: '#1f2937',
    border: '1px solid #374151',
    borderRadius: 14,
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
};
