import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  StaleRidersAlertBanner,
  createRiderMarkerIcon,
  RiderRosterRow,
  StopDetailSheet,
  NextStopBottomDock,
  PresetsTellGroupSheet,
  NearbyHelpSheet,
  getFreshness,
} from '../components';
import type { PinnedStopData } from '../components/PinStopModal';
import type { RiderArrivalInfo } from '../components/StopArrivalTracker';
import type { RiderRosterData } from '../components/RiderRosterRow';

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
function makeMyNavIcon(color: string, heading: number, status: string, isStale: boolean = false) {
  const badge = status ? `<div style="position:absolute;bottom:-20px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#1f2937;color:#fff;font-size:10px;padding:2px 6px;border-radius:8px;font-weight:600;">${status}</div>` : '';
  const fill = isStale ? '#111827' : color;
  const stroke = color;
  const opacity = isStale ? '0.75' : '1';
  const ringAura = isStale ? '' : `<circle cx="22" cy="22" r="20" fill="${color}" stroke="white" stroke-width="2.5" opacity="0.25"/>`;

  return L.divIcon({
    className: '',
    iconAnchor: [24, 24],
    iconSize: [48, 48 + (status ? 24 : 0)],
    html: `<div style="position:relative;width:48px;height:48px;display:flex;align-items:center;justify-content:center;opacity:${opacity};">
      <div style="transform:rotate(${heading}deg);width:48px;height:48px;display:flex;align-items:center;justify-content:center;">
        <svg width="44" height="44" viewBox="0 0 44 44">
          ${ringAura}
          <polygon points="22,4 34,38 22,30 10,38" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>
          <circle cx="22" cy="22" r="5" fill="white"/>
        </svg>
      </div>
      ${badge}
    </div>`,
  });
}

// Circle icon for other riders - replaced by createRiderMarkerIcon

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
function MapFollow({
  lat,
  lng,
  following,
  focusTarget,
  onDrag,
}: {
  lat: number;
  lng: number;
  following: boolean;
  focusTarget?: [number, number] | null;
  onDrag: () => void;
}) {
  const map = useMap();
  const onDragRef = useRef(onDrag);
  onDragRef.current = onDrag;

  useEffect(() => {
    if (focusTarget) {
      map.setView(focusTarget, Math.max(map.getZoom(), 17), { animate: true, duration: 0.6 });
    } else if (following) {
      map.setView([lat, lng], Math.max(map.getZoom(), 17), { animate: true, duration: 0.6, easeLinearity: 0.4 });
    }
  }, [lat, lng, following, focusTarget, map]);

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

  // Mobile Mockup UX & Last-seen State
  const [splitView, setSplitView] = useState(true);
  const [showStopDetailSheet, setShowStopDetailSheet] = useState(false);
  const [showTellGroupSheet, setShowTellGroupSheet] = useState(false);
  const [showNearbyHelp, setShowNearbyHelp] = useState(false);
  const [focusTarget, setFocusTarget] = useState<[number, number] | null>(null);
  const myLastUpdatedRef = useRef<string | null>(null);

  // Auto-refresh interval (5s) for real-time age badges and hollow markers
  const [, setTicker] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTicker((t) => t + 1), 5000);
    return () => clearInterval(timer);
  }, []);

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
        myLastUpdatedRef.current = new Date().toISOString();
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

  const myFreshness = getFreshness(myLastUpdatedRef.current ?? (myLat ? new Date().toISOString() : null));

  // Compute freshness for all riders (Last-seen Engine)
  const ridersWithFreshness: RiderRosterData[] = useMemo(() => {
    return riders.map((r, i) => {
      const isMe = r.user_id === user?.id;
      const freshness = isMe ? myFreshness : getFreshness(r.updated_at);
      const isCaptain = session?.started_by === r.user_id;
      const dist = myLat && myLng && r.lat && r.lng ? haversineKm(myLat, myLng, Number(r.lat), Number(r.lng)) : null;
      const color = RIDER_COLORS[i % RIDER_COLORS.length];

      return {
        userId: r.user_id,
        userName: r.user_name || 'Rider',
        isMe,
        isCaptain,
        lat: Number(r.lat),
        lng: Number(r.lng),
        speedKmh: r.speed_kmh,
        heading: r.heading,
        quickStatus: r.quick_status,
        updatedAt: r.updated_at,
        distanceKm: dist,
        color,
        freshness,
      };
    });
  }, [riders, user?.id, myFreshness, session?.started_by, myLat, myLng]);

  // Stale and unknown riders (for alert banner)
  const staleRiders = useMemo(() => {
    return ridersWithFreshness.filter((r) => !r.isMe && (r.freshness.isStale || r.freshness.isUnknown));
  }, [ridersWithFreshness]);

  // Format riders for StopDetailSheet
  const ridersForStopDetail = useMemo(() => {
    return ridersWithFreshness.map((r) => {
      const arrival = ridersArrival[r.userId];
      return {
        userId: r.userId,
        userName: r.userName,
        isMe: r.isMe,
        freshness: r.freshness,
        distanceKm: pinnedStop ? haversineKm(r.lat, r.lng, pinnedStop.lat, pinnedStop.lng) : null,
        speedKmh: r.speedKmh,
        arrivalStatus: arrival?.status ?? 'en_route',
        arrivedAt: arrival?.arrivedAt,
      };
    });
  }, [ridersWithFreshness, ridersArrival, pinnedStop]);

  const arrivedCount = useMemo(() => {
    return Object.values(ridersArrival).filter((r) => r.status === 'arrived').length;
  }, [ridersArrival]);

  const enrichedRidersArrival = useMemo(() => {
    const result: Record<string, RiderArrivalInfo> = {};
    for (const [uid, arrival] of Object.entries(ridersArrival)) {
      const riderMeta = ridersWithFreshness.find((r) => r.userId === uid);
      result[uid] = {
        ...arrival,
        isStale: riderMeta ? (riderMeta.freshness.isStale || riderMeta.freshness.isUnknown) : false,
        ageLabel: riderMeta?.freshness.ageLabel,
      };
    }
    return result;
  }, [ridersArrival, ridersWithFreshness]);

  const handleFocusRider = useCallback((rider: RiderRosterData) => {
    setFocusTarget([rider.lat, rider.lng]);
    setFollowing(false);
    setToast(`Focused on ${rider.userName} (${rider.freshness.ageLabel})`);
    setTimeout(() => {
      setToast('');
      setFocusTarget(null);
    }, 2500);
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
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', backgroundColor: '#0f172a', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', overflow: 'hidden' }}>
      {/* SOS Banner */}
      {sosActive && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, background: '#dc2626', color: '#fff', padding: '12px 16px', textAlign: 'center', fontWeight: 700, fontSize: 15, animation: 'pulse 1s infinite' }}>
          🆘 SOS ALERT — A rider needs help! Check the Riders tab.
          <button onClick={() => setSosActive(false)} style={{ marginLeft: 12, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 6, padding: '2px 10px', cursor: 'pointer', fontWeight: 600 }}>Dismiss</button>
        </div>
      )}

      {/* Header — Sleek, uncrowded, modern cockpit styling for all screen sizes */}
      <div style={{
        backgroundColor: '#0f172a',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        flexShrink: 0,
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        marginTop: sosActive ? 48 : 0,
      }}>
        {/* Left: Round Back button + Title & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              backgroundColor: '#1e293b',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              fontSize: 18,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            title="Leave Ride Screen"
          >
            ←
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{
              color: '#ffffff',
              fontWeight: 800,
              fontSize: 15,
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              letterSpacing: -0.3,
            }}>
              {session?.trips?.title ?? 'Group Ride'}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
              <span style={{
                color: '#10b981',
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 0.3,
              }}>
                ● LIVE · {riders.length} {riders.length === 1 ? 'rider' : 'riders'}
              </span>
              {staleRiders.length > 0 && (
                <span style={{
                  color: '#f59e0b',
                  fontSize: 11,
                  fontWeight: 700,
                }}>
                  · ⚠️ {staleRiders.length} stale
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Quick SOS Trigger Pill */}
          <button
            type="button"
            onClick={sendSOS}
            style={{
              padding: '6px 10px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1.5px solid #ef4444',
              color: '#fca5a5',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Emergency Convoy SOS"
          >
            <span>🚨</span>
            <span>SOS</span>
          </button>

          {/* Nearby Amenities */}
          <button
            type="button"
            onClick={() => setShowNearbyHelp(true)}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              backgroundColor: '#1e293b',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#34d399',
              fontSize: 15,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Verified Nearby Help (Fuel, Repair, Food, Rest)"
          >
            🛠️
          </button>

          {/* Captain Broadcast Alert */}
          {isLead && (
            <button
              type="button"
              onClick={() => setShowAnnouncementModal(true)}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                border: '1.5px solid #f59e0b',
                color: '#fbbf24',
                fontSize: 15,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Broadcast alert to all riders"
            >
              📢
            </button>
          )}

          {/* End / Leave Ride */}
          {isLead ? (
            <button
              onClick={handleEndRide}
              disabled={endingRide}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                backgroundColor: 'rgba(220, 38, 38, 0.2)',
                border: '1px solid #dc2626',
                color: '#fca5a5',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="End ride for everyone"
            >
              {endingRide ? '...' : '⏹'}
            </button>
          ) : (
            <button
              onClick={() => navigate(-1)}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                backgroundColor: '#1e293b',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#94a3b8',
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Leave Ride Screen"
            >
              🚪
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
          ridersArrival={enrichedRidersArrival}
          currentUserId={user?.id}
          myDistanceKm={myLat && myLng ? haversineKm(myLat, myLng, pinnedStop.lat, pinnedStop.lng) : null}
          mySpeedKmh={myPosRef.current ? 0 : 0}
          isMyStale={myFreshness.isStale || myFreshness.isUnknown}
          myAgeLabel={myFreshness.ageLabel}
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

      {/* Map tab — always rendered, shown/hidden via visibility so Leaflet doesn't break */}
      <div style={{ flex: tab === 'map' ? 1 : 0, overflow: 'hidden', display: tab === 'map' ? 'flex' : 'none', flexDirection: 'column', position: 'relative' }}>
        {/* Map Section (48% in split mode, 100% in full mode) */}
        <div style={{
          height: splitView ? '48%' : '100%',
          position: 'relative',
          overflow: 'hidden',
          transition: 'height 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          flexShrink: 0,
        }}>
          {gpsError && (
            <div style={{
              position: 'absolute',
              inset: 0,
              zIndex: 2000,
              backgroundColor: 'rgba(17, 24, 39, 0.88)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}>
              <div style={{
                backgroundColor: '#fdfbf7',
                borderRadius: 24,
                padding: '24px 20px',
                maxWidth: 340,
                width: '100%',
                boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                textAlign: 'left',
                color: '#111827',
              }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: '#f59e0b', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                  STEP 2 OF 3
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 8px', color: '#111827' }}>
                  Live trip tracking
                </h3>
                <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.5, margin: '0 0 20px' }}>
                  We use your location only while a trip is active, so your group can see where you are.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setGpsError('');
                      navigator.geolocation?.getCurrentPosition(
                        () => setGpsError(''),
                        (err) => setGpsError(err.message || 'GPS permission needed')
                      );
                    }}
                    style={{
                      padding: '13px',
                      backgroundColor: 'var(--accent-gold, #f59e0b)',
                      color: '#111827',
                      border: 'none',
                      borderRadius: 14,
                      fontWeight: 900,
                      fontSize: 14,
                      cursor: 'pointer',
                    }}
                  >
                    Allow location
                  </button>
                  <button
                    type="button"
                    onClick={() => setGpsError('')}
                    style={{
                      padding: '12px',
                      backgroundColor: '#ffffff',
                      color: '#374151',
                      border: '1.5px solid #d1d5db',
                      borderRadius: 14,
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Not now
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* View Mode Toggle: Map + Roster vs Full Map */}
          <button
            type="button"
            onClick={() => setSplitView(!splitView)}
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              zIndex: 1000,
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              color: '#ffffff',
              borderRadius: 24,
              padding: '7px 14px',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
            }}
            title="Toggle split roster and map view"
          >
            <span>{splitView ? '⛶ Full Map' : '📋 Map + Roster'}</span>
          </button>

          {/* Re-center button */}
          {!following && myLat && myLng && (
            <button
              onClick={() => { setFollowing(true); setFocusTarget(null); }}
              style={{
                position: 'absolute',
                bottom: 16,
                right: 16,
                zIndex: 1000,
                backgroundColor: '#1e293b',
                border: '2px solid #f59e0b',
                color: '#f59e0b',
                borderRadius: '50%',
                width: 46,
                height: 46,
                fontSize: 20,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
              }}
              title="Re-center on me"
            >
              📍
            </button>
          )}

          {/* Wake lock indicator */}
          {wakeLockActive && (
            <div style={{
              position: 'absolute',
              top: 12,
              right: 12,
              zIndex: 999,
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(52, 211, 153, 0.35)',
              color: '#34d399',
              fontSize: 11,
              fontWeight: 800,
              padding: '6px 10px',
              borderRadius: 20,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
            }}>
              🔆 Screen on
            </div>
          )}

          <MapContainer center={defaultCenter} zoom={18} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap"
            />
            {myLat && myLng && (
              <MapFollow lat={myLat} lng={myLng} following={following} focusTarget={focusTarget} onDrag={() => { setFollowing(false); setFocusTarget(null); }} />
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
            {/* My navigation arrow — rotates with heading and dims if stale */}
            {myLat && myLng && (
              <Marker
                position={[myLat, myLng]}
                icon={makeMyNavIcon(colorForUser(user?.id ?? ''), myHeading, myStatus, myFreshness.isStale)}
              />
            )}
            {/* Other riders — dynamic Last-seen marker (solid if live, hollow if stale/unknown) */}
            {ridersWithFreshness.filter((r) => !r.isMe).map((r) => (
              <Marker
                key={r.userId}
                position={[r.lat, r.lng]}
                icon={createRiderMarkerIcon(r.userName, r.color, r.quickStatus ?? '', r.freshness, r.isCaptain)}
              />
            ))}
          </MapContainer>
        </div>

        {/* In Split View: Alert Banner + Rider Roster (Mockup Screen 1) */}
        {splitView && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#0f172a' }}>
            {/* Stale Riders Warning Banner */}
            <StaleRidersAlertBanner
              staleCount={staleRiders.length}
              staleRiderNames={staleRiders.map((r) => r.userName)}
              onClick={() => setTab('riders')}
            />

            {/* Rider Roster List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 14px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 2px 8px' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                  Convoy Roster ({ridersWithFreshness.length})
                </span>
                <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>
                  ● {ridersWithFreshness.filter(r => r.freshness.isLive).length} LIVE
                </span>
              </div>

              {ridersWithFreshness.length === 0 && (
                <p style={{ color: '#6b7280', textAlign: 'center', marginTop: 24, fontSize: 13 }}>
                  Waiting for riders to join and share GPS...
                </p>
              )}

              {ridersWithFreshness.map((rider) => (
                <RiderRosterRow
                  key={rider.userId}
                  rider={rider}
                  onClick={handleFocusRider}
                />
              ))}
            </div>
          </div>
        )}

        {/* Next Stop Bottom Dock (Screen 1 mockup signature) */}
        <NextStopBottomDock
          pinnedStop={pinnedStop}
          distanceKm={pinnedStop && myLat && myLng ? haversineKm(myLat, myLng, pinnedStop.lat, pinnedStop.lng) : null}
          arrivedCount={arrivedCount}
          totalCount={ridersWithFreshness.length}
          onOpenDetail={() => setShowStopDetailSheet(true)}
          onOpenTellGroup={() => setShowTellGroupSheet(true)}
          onPinNewStop={() => setShowPinModal(true)}
        />
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
            <button
              type="button"
              onClick={() => setShowNearbyHelp(true)}
              style={{ ...styles.chatQuickPill, borderColor: '#10b981', color: '#34d399' }}
            >
              🛠️ Nearby Help (Fuel/Repair)
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

      {/* Riders panel — Convoy Roster with Last-seen Freshness & Hollow Markers */}
      {tab === 'riders' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', backgroundColor: '#0f172a' }}>
          {/* Stale Riders Warning Banner */}
          <StaleRidersAlertBanner
            staleCount={staleRiders.length}
            staleRiderNames={staleRiders.map((r) => r.userName)}
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '8px 2px 10px' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', letterSpacing: 0.8, textTransform: 'uppercase' }}>
              Convoy Roster ({ridersWithFreshness.length})
            </span>
            <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>
              ● {ridersWithFreshness.filter((r) => r.freshness.isLive).length} LIVE
            </span>
          </div>

          {ridersWithFreshness.length === 0 && (
            <p style={{ color: '#6b7280', textAlign: 'center', marginTop: 40, fontSize: 13 }}>
              No riders online yet. Positions will appear here when riders connect.
            </p>
          )}

          {ridersWithFreshness.map((rider) => (
            <RiderRosterRow
              key={rider.userId}
              rider={rider}
              onClick={(r) => {
                setTab('map');
                handleFocusRider(r);
              }}
            />
          ))}
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

      {/* Bottom tab bar — Sleek, thumb-friendly navigation designed for all ages */}
      <div style={{
        backgroundColor: '#0f172a',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '6px 4px 8px',
        flexShrink: 0,
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.45)',
      }}>
        {/* Tab 1: Map Tracking */}
        <button
          type="button"
          onClick={() => setTab('map')}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            padding: '4px 2px',
            color: tab === 'map' ? '#f59e0b' : '#94a3b8',
            transition: 'all 0.15s ease',
          }}
        >
          <span style={{ fontSize: 20 }}>🗺️</span>
          <span style={{
            fontSize: 11,
            fontWeight: tab === 'map' ? 900 : 600,
            letterSpacing: 0.3,
          }}>
            Map
          </span>
          {tab === 'map' && (
            <div style={{ width: 18, height: 2.5, backgroundColor: '#f59e0b', borderRadius: 2 }} />
          )}
        </button>

        {/* Tab 2: Tell Group / Status Presets */}
        <button
          type="button"
          onClick={() => setShowTellGroupSheet(true)}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            padding: '4px 2px',
            color: myStatus ? '#f59e0b' : '#94a3b8',
            transition: 'all 0.15s ease',
          }}
        >
          <span style={{ fontSize: 20 }}>⚡</span>
          <span style={{
            fontSize: 11,
            fontWeight: myStatus ? 900 : 600,
            letterSpacing: 0.3,
          }}>
            {myStatus ? 'Status ●' : 'Presets'}
          </span>
        </button>

        {/* Tab 3: Trip Chat */}
        <button
          type="button"
          onClick={() => setTab(tab === 'chat' ? 'map' : 'chat')}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            padding: '4px 2px',
            color: tab === 'chat' ? '#f59e0b' : '#94a3b8',
            position: 'relative',
            transition: 'all 0.15s ease',
          }}
        >
          <span style={{ fontSize: 20 }}>💬</span>
          <span style={{
            fontSize: 11,
            fontWeight: tab === 'chat' ? 900 : 600,
            letterSpacing: 0.3,
          }}>
            Chat
          </span>
          {newMsgCount > 0 && tab !== 'chat' && (
            <span style={{
              position: 'absolute',
              top: 2,
              right: '25%',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              fontSize: 10,
              fontWeight: 900,
              width: 17,
              height: 17,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)',
            }}>
              {newMsgCount > 9 ? '9+' : newMsgCount}
            </span>
          )}
          {tab === 'chat' && (
            <div style={{ width: 18, height: 2.5, backgroundColor: '#f59e0b', borderRadius: 2 }} />
          )}
        </button>

        {/* Tab 4: Convoy Roster */}
        <button
          type="button"
          onClick={() => setTab(tab === 'riders' ? 'map' : 'riders')}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            padding: '4px 2px',
            color: tab === 'riders' ? '#f59e0b' : '#94a3b8',
            position: 'relative',
            transition: 'all 0.15s ease',
          }}
        >
          <span style={{ fontSize: 20 }}>👥</span>
          <span style={{
            fontSize: 11,
            fontWeight: tab === 'riders' ? 900 : 600,
            letterSpacing: 0.3,
          }}>
            Convoy
          </span>
          {staleRiders.length > 0 && tab !== 'riders' && (
            <span style={{
              position: 'absolute',
              top: 3,
              right: '24%',
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#f59e0b',
              boxShadow: '0 0 6px #f59e0b',
            }} />
          )}
          {tab === 'riders' && (
            <div style={{ width: 18, height: 2.5, backgroundColor: '#f59e0b', borderRadius: 2 }} />
          )}
        </button>

        {/* Tab 5: External Nav / Turns */}
        <button
          type="button"
          onClick={() => setTab(tab === 'nav' ? 'map' : 'nav')}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            padding: '4px 2px',
            color: tab === 'nav' ? '#f59e0b' : '#94a3b8',
            position: 'relative',
            transition: 'all 0.15s ease',
          }}
        >
          <span style={{ fontSize: 20 }}>🧭</span>
          <span style={{
            fontSize: 11,
            fontWeight: tab === 'nav' ? 900 : 600,
            letterSpacing: 0.3,
          }}>
            Nav
          </span>
          {tab === 'nav' && (
            <div style={{ width: 18, height: 2.5, backgroundColor: '#f59e0b', borderRadius: 2 }} />
          )}
        </button>
      </div>

      {/* One-Tap Rider Status Drawer (Fallback Detailed) */}
      <QuickStatusDrawer
        isOpen={showStatusDrawer}
        onClose={() => setShowStatusDrawer(false)}
        currentStatus={myStatus}
        onSelectStatus={pickStatus}
      />

      {/* Large-target Presets Sheet ("Tell group", Mockup Screen 3) */}
      <PresetsTellGroupSheet
        isOpen={showTellGroupSheet}
        onClose={() => setShowTellGroupSheet(false)}
        onSelectStatus={(val) => pickStatus(val)}
        isCaptain={isLead}
        onSendAnnouncement={(label) => {
          handleSendAnnouncement({
            title: label,
            message: `Lead announced: ${label}`,
            urgency: 'high',
            icon: '⚠️',
          });
        }}
      />

      {/* Next Stop Detail Bottom Sheet (Mockup Screen 2) */}
      <StopDetailSheet
        isOpen={showStopDetailSheet}
        onClose={() => setShowStopDetailSheet(false)}
        pinnedStop={pinnedStop}
        riders={ridersForStopDetail}
        myDistanceKm={pinnedStop && myLat && myLng ? haversineKm(myLat, myLng, pinnedStop.lat, pinnedStop.lng) : null}
        mySpeedKmh={myPosRef.current ? 0 : 0}
        myFreshness={myFreshness}
        isMeArrived={user?.id ? (ridersArrival[user.id]?.status === 'arrived') : false}
        onToggleMyArrival={handleToggleMyArrival}
        onOpenNavigation={(target) => {
          setNavTarget(target);
          setShowNavModal(true);
        }}
        onChangeStop={() => {
          setShowStopDetailSheet(false);
          setShowPinModal(true);
        }}
      />

      {/* Route-Cached Verified Amenities ("Nearby help", Mockup Screen 5) */}
      <NearbyHelpSheet
        isOpen={showNearbyHelp}
        onClose={() => setShowNearbyHelp(false)}
        currentGps={myLat && myLng ? { lat: myLat, lng: myLng } : null}
        onNavigate={(target) => {
          setNavTarget(target);
          setShowNavModal(true);
        }}
        onPinAsStop={(item) => {
          handlePinStop({
            id: `nearby_${Date.now()}`,
            name: item.name,
            lat: item.lat,
            lng: item.lng,
            type: item.type,
          });
        }}
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
