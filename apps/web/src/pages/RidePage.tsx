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
  OfflineSignalBanner,
  RouteDeviationCard,
  BatterySaverNote,
  MeRideSettingsTab,
  RouteProgressStrip,
  StopApproachCard,
  MissedStopPromptCard,
  ArrivalOfferBanner,
  PresetCard,
  getFreshness,
  evaluateRiderDeviation,
  getMinDistanceToRoute,
  formatOffRouteDistance,
  getBatterySaverPreference,
  setBatterySaverPreference,
  calculateRouteProgress,
  getRouteTotalDistance,
  evaluateRiderRouteStatus,
  evaluateStopApproach,
  detectArrivalZone,
  detectMissedStop,
  getPresetInfo,
  RIDER_STATUS_PRESETS,
  CAPTAIN_ALERT_VIBRATION_PATTERN,
  CAPTAIN_SENT_VIBRATION_PATTERN,
} from '../components';
import type { RiderDeviationTracker, OffRouteAlert, RouteProgressRider, RouteMilestoneStop, DeliveryReceipt } from '../components';
import { offlinePositionQueue, OfflineQueueState } from '../lib/offlinePositionQueue';
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
  const badge = status ? `<div style="position:absolute;bottom:-20px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#1B1E23;color:#F1EFEA;border:1.5px solid #2A2E35;font-size:10px;padding:2px 7px;border-radius:8px;font-weight:800;box-shadow:0 3px 8px rgba(0,0,0,0.4);">${status}</div>` : '';
  const fill = isStale ? '#1B1E23' : '#F0C23A';
  const stroke = isStale ? color : '#111316';
  const opacity = isStale ? '0.8' : '1';
  const ringAura = isStale ? '' : `<circle cx="22" cy="22" r="20" fill="#F0C23A" stroke="#111316" stroke-width="2" opacity="0.3"/>`;

  return L.divIcon({
    className: '',
    iconAnchor: [24, 24],
    iconSize: [48, 48 + (status ? 24 : 0)],
    html: `<div style="position:relative;width:48px;height:48px;display:flex;align-items:center;justify-content:center;opacity:${opacity};">
      <div style="transform:rotate(${heading}deg);width:48px;height:48px;display:flex;align-items:center;justify-content:center;">
        <svg width="44" height="44" viewBox="0 0 44 44">
          ${ringAura}
          <polygon points="22,4 34,38 22,30 10,38" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>
          <circle cx="22" cy="22" r="5" fill="#111316"/>
        </svg>
      </div>
      ${badge}
    </div>`,
  });
}

// Circle icon for other riders - replaced by createRiderMarkerIcon

function makeStopIcon(placeName?: string, itemType?: string, orderIndex?: number) {
  const iconEmoji = itemType === 'fuel' ? '⛽' : itemType === 'food' ? '🍲' : itemType === 'rest' ? '☕' : '📍';
  const label = placeName ? placeName.slice(0, 14) : `Stop ${orderIndex ?? ''}`;
  return L.divIcon({
    className: 'stop-milestone-marker',
    iconAnchor: [12, 12],
    iconSize: [24, 24],
    html: `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
        <div style="width:24px;height:24px;background:#1B1E23;border:2px solid #F0C23A;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.6);font-size:11px;">
          ${iconEmoji}
        </div>
        <div style="position:absolute;top:26px;background:#111316;color:#F1EFEA;border:1px solid #2A2E35;padding:1px 6px;border-radius:6px;font-size:9px;font-weight:800;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.5);letter-spacing:-0.2px;">
          ${label}
        </div>
      </div>
    `,
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

function playAlertChime(type: 'urgent' | 'chime' | 'alert' = 'chime') {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type === 'urgent' || type === 'alert' ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(type === 'alert' ? 659.25 : (type === 'urgent' ? 784 : 587.33), ctx.currentTime);
    osc.frequency.setValueAtTime(type === 'alert' ? 523.25 : (type === 'urgent' ? 880 : 880), ctx.currentTime + 0.12);

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

function MapResizer({ splitView }: { splitView: boolean }) {
  const map = useMap();
  useEffect(() => {
    // Invalidate size immediately and during CSS transition so tiles load across 100% of the canvas
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 50);
    const t2 = setTimeout(() => map.invalidateSize(), 150);
    const t3 = setTimeout(() => map.invalidateSize(), 300);
    const t4 = setTimeout(() => map.invalidateSize(), 550);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [splitView, map]);

  return null;
}

type TabType = 'map' | 'chat' | 'riders' | 'nav' | 'plan' | 'discover' | 'me';

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
  const [mySpeedKmh, setMySpeedKmh] = useState(0);
  const [osrmRoute, setOsrmRoute] = useState<[number, number][]>([]);
  const [navSteps, setNavSteps] = useState<NavStep[]>([]);
  const [endingRide, setEndingRide] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);

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

  // Feature B: Offline Position Queue & Rider Trails State
  const [queueState, setQueueState] = useState<OfflineQueueState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pendingCount: 0,
    lastSyncedAt: null,
    isSyncing: false,
  });
  const [justSynced, setJustSynced] = useState(false);
  const [riderTrails, setRiderTrails] = useState<Record<string, Array<[number, number]>>>({});
  const isSyncingBatchRef = useRef(false);

  // Feature C: Route Deviation Tracker State
  const [deviationTrackers, setDeviationTrackers] = useState<Record<string, RiderDeviationTracker>>({});
  const [dismissedDeviations, setDismissedDeviations] = useState<Set<string>>(new Set());

  // Feature D: Battery-saver mode State (Me > Ride settings > Battery saver)
  const [batterySaver, setBatterySaver] = useState<boolean>(() => getBatterySaverPreference());
  const lastBroadcastTimeRef = useRef<number>(0);

  const handleToggleBatterySaver = useCallback((enabled: boolean) => {
    setBatterySaver(enabled);
    setBatterySaverPreference(enabled);
    setToast(enabled ? '⚡ Battery saver enabled (30s update rate)' : '⚡ Standard telemetry restored (10s rate)');
    setTimeout(() => setToast(''), 3000);
  }, []);

  // Feature J: Arrival detection offer and Missed stop prompt states
  const [arrivalOfferDismissed, setArrivalOfferDismissed] = useState(false);
  const [missedPromptDismissed, setMissedPromptDismissed] = useState(false);
  const minDistToPinnedStopKmRef = useRef<number>(Infinity);

  useEffect(() => {
    setArrivalOfferDismissed(false);
    setMissedPromptDismissed(false);
    minDistToPinnedStopKmRef.current = Infinity;
  }, [pinnedStop?.name, pinnedStop?.lat, pinnedStop?.lng]);

  // Feature G: Message Delivery Receipts State (Per-rider delivery tracking)
  const [deliveryReceipts, setDeliveryReceipts] = useState<Record<string, DeliveryReceipt[]>>({});

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

  // Fetch road-following route from trip plan: start → itinerary stops → destination
  // Loads immediately from trip plan (Plan tab) even before GPS, and refreshes every 2 min
  const routeFetchedRef = useRef(false);
  useEffect(() => {
    if (!session) return;

    const buildRoute = async () => {
      const { trips } = session;
      const stopCoords: [number, number][] = (session.itinerary ?? [])
        .filter((s) => s.lat && s.lng)
        .map((s) => [s.lat as number, s.lng as number]);

      let startPoint: [number, number] | null = null;
      if (myPosRef.current) {
        startPoint = [myPosRef.current.lat, myPosRef.current.lng];
      } else if (trips.from_lat && trips.from_lng) {
        startPoint = [trips.from_lat, trips.from_lng];
      } else if (trips.from_place) {
        startPoint = await geocodePlaceName(trips.from_place);
      }

      let destination: [number, number] | null = null;
      if (trips.to_lat && trips.to_lng) {
        destination = [trips.to_lat, trips.to_lng];
      } else if (trips.to_place) {
        destination = await geocodePlaceName(trips.to_place);
      }

      const waypoints: [number, number][] = [
        ...(startPoint ? [startPoint] : []),
        ...stopCoords,
        ...(destination ? [destination] : []),
      ];
      if (waypoints.length < 2) return;

      const { route, steps } = await fetchOsrmRoute(waypoints);
      setOsrmRoute(route);
      setNavSteps(steps);
      routeFetchedRef.current = true;
    };

    // Initial fetch — immediately load planned route from trip plan
    buildRoute();
    // Refresh every 2 min so route updates as you progress
    const interval = setInterval(buildRoute, 120_000);
    return () => { clearInterval(interval); };
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
        // Immediately sync any fixes queued while in background/screen locked
        syncPendingBatch();
        // Re-broadcast current position immediately after coming back
        if (myPosRef.current && channelRef.current) {
          channelRef.current.send({
            type: 'broadcast', event: 'location',
            payload: { userId: user?.id, userName, lat: myPosRef.current.lat, lng: myPosRef.current.lng, speedKmh: 0, heading: 0, updatedAt: new Date().toISOString() },
          });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      wakeLockRef.current?.release().catch(() => {});
    };
  }, [session, ended, userName, user?.id]);

  // Feature B: Sync queued positions in batches and in sequence order
  const syncPendingBatch = useCallback(async () => {
    if (!sessionId || !user?.id || isSyncingBatchRef.current) return;
    if (!navigator.onLine) {
      offlinePositionQueue.setOnlineStatus(false);
      return;
    }

    const pending = await offlinePositionQueue.getPendingFixes(sessionId, 50);
    if (pending.length === 0) return;

    isSyncingBatchRef.current = true;
    offlinePositionQueue.setSyncing(true);

    try {
      const res = await rideService.uploadLocationBatch(
        sessionId,
        pending.map((p) => ({
          lat: p.lat,
          lng: p.lng,
          speedKmh: p.speedKmh,
          heading: p.heading,
          userName: p.userName,
          seq: p.seq,
          timestamp: p.timestamp,
        })),
        userName,
      );

      const ids = pending.map((p) => p.id!).filter(Boolean);
      await offlinePositionQueue.markFixesSynced(sessionId, ids);

      // Requirement 5: Group map catches up: Riders' trails fill in and their markers move to current position
      channelRef.current?.send({
        type: 'broadcast',
        event: 'trail_catchup',
        payload: {
          userId: user.id,
          userName,
          latestLocation: res?.latestLocation || {
            lat: pending[pending.length - 1].lat,
            lng: pending[pending.length - 1].lng,
            speed_kmh: pending[pending.length - 1].speedKmh,
            heading: pending[pending.length - 1].heading,
            updated_at: pending[pending.length - 1].timestamp,
          },
          trailPoints: pending.map((p) => [p.lat, p.lng]),
        },
      });

      setJustSynced(true);
      setTimeout(() => setJustSynced(false), 3500);
    } catch (err) {
      console.warn('Batch upload paused due to connection error:', err);
      offlinePositionQueue.setOnlineStatus(false);
    } finally {
      isSyncingBatchRef.current = false;
      offlinePositionQueue.setSyncing(false);
      await offlinePositionQueue.refreshPendingCount(sessionId);
    }
  }, [sessionId, user?.id, userName]);

  // Feature B: Queue listener, network change hooks, and initial trail loading
  useEffect(() => {
    if (!sessionId || !user?.id) return;

    const unsubscribe = offlinePositionQueue.subscribe((st) => {
      setQueueState(st);
    });
    offlinePositionQueue.refreshPendingCount(sessionId);

    // Load local recorded trail from IndexedDB
    offlinePositionQueue.getLocalTrail(sessionId, user.id).then((pts) => {
      if (pts.length > 0) {
        setRiderTrails((prev) => ({ ...prev, [user.id]: pts }));
      }
    });

    // Load group trails from server
    rideService.getRiderTrails(sessionId).then((d) => {
      if (d?.trails) {
        setRiderTrails((prev) => ({ ...d.trails, ...prev }));
      }
    }).catch(() => {});

    const handleOnline = () => {
      offlinePositionQueue.setOnlineStatus(true);
      syncPendingBatch();
    };
    const handleOffline = () => {
      offlinePositionQueue.setOnlineStatus(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const queueTimer = setInterval(() => {
      syncPendingBatch();
    }, 15000);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(queueTimer);
    };
  }, [sessionId, user?.id, syncPendingBatch]);

  // Start GPS watch — broadcast on every fix, DB upsert every 15s
  useEffect(() => {
    if (!sessionId || !session || ended) return;
    if (!navigator.geolocation) { setGpsError('GPS not supported on this device'); return; }

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng, speed, heading } = pos.coords;
        setMyLat(lat); setMyLng(lng);
        myPosRef.current = { lat, lng };
        const nowIso = new Date().toISOString();
        myLastUpdatedRef.current = nowIso;
        const speedKmh = speed != null ? speed * 3.6 : 0;
        setMySpeedKmh(speedKmh);
        const hdg = heading ?? 0;
        if (heading != null) setMyHeading(heading);

        // Auto-arrival detection when within 250m of pinned stop
        if (pinnedStop) {
          const distKm = haversineKm(lat, lng, pinnedStop.lat, pinnedStop.lng);
          if (distKm < 0.25 && user?.id && ridersArrival[user.id]?.status !== 'arrived') {
            handleToggleMyArrival(true);
          }
        }

        if (!user?.id) return;

        // STEP 1: GPS fix recorded — written to phone's local database before app treats it as saved
        try {
          const seq = await offlinePositionQueue.getNextSequence(sessionId, user.id);
          await offlinePositionQueue.enqueueFix({
            sessionId,
            userId: user.id,
            userName,
            lat,
            lng,
            speedKmh,
            heading: hdg,
            seq,
            timestamp: nowIso,
          });
        } catch (err) {
          console.warn('Local position queue write error:', err);
        }

        // STEP 5: Add point to local rider trail immediately so rider sees path even offline
        setRiderTrails((prev) => ({
          ...prev,
          [user.id]: [...(prev[user.id] || []), [lat, lng]],
        }));

        // Feature D: Update rate drops -> "Positions are sent about every 30 s instead of about every 10 s."
        const throttleIntervalMs = batterySaver ? 30000 : 10000;
        const nowMs = Date.now();
        const shouldBroadcast = (nowMs - lastBroadcastTimeRef.current) >= throttleIntervalMs;

        if (navigator.onLine && shouldBroadcast) {
          lastBroadcastTimeRef.current = nowMs;
          channelRef.current?.send({
            type: 'broadcast', event: 'location',
            payload: { userId: user.id, userName, lat, lng, speedKmh, heading: hdg, updatedAt: nowIso },
          });
          syncPendingBatch();
        } else if (!navigator.onLine) {
          offlinePositionQueue.setOnlineStatus(false);
        }
      },
      (err) => {
        if (err.code === 1) setGpsError('Location permission denied. Please enable GPS.');
        else setGpsError('Unable to get your location.');
      },
      { enableHighAccuracy: !batterySaver, maximumAge: batterySaver ? 15000 : 2000, timeout: 10000 },
    );

    // DB upsert throttled based on battery saver (30s vs 15s)
    const dbIntervalMs = batterySaver ? 30000 : 15000;
    dbSyncRef.current = setInterval(() => {
      if (myPosRef.current && navigator.onLine) {
        rideService.updateLocation(sessionId, { ...myPosRef.current, speedKmh: 0, userName }).catch(() => {});
      }
    }, dbIntervalMs);

    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (dbSyncRef.current) clearInterval(dbSyncRef.current);
    };
  }, [session, ended, sessionId, userName, user?.id, syncPendingBatch, pinnedStop, ridersArrival, batterySaver]);

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
        // Requirement 5: Append point to rider's trail
        if (payload.lat && payload.lng && payload.userId) {
          setRiderTrails((prev) => ({
            ...prev,
            [payload.userId]: [...(prev[payload.userId] || []), [payload.lat, payload.lng]],
          }));
        }
      })
      .on('broadcast', { event: 'trail_catchup' }, ({ payload }) => {
        if (!payload || !payload.userId) return;
        // Requirement 5: Group map catches up: Riders' trails fill in and their markers move to current position
        if (payload.latestLocation) {
          setRiders((prev) => {
            const idx = prev.findIndex((r) => r.user_id === payload.userId);
            const entry: RiderLocation = {
              user_id: payload.userId,
              user_name: payload.userName,
              lat: payload.latestLocation.lat,
              lng: payload.latestLocation.lng,
              speed_kmh: payload.latestLocation.speed_kmh ?? 0,
              heading: payload.latestLocation.heading ?? 0,
              quick_status: idx >= 0 ? prev[idx].quick_status : '',
              updated_at: payload.latestLocation.updated_at || new Date().toISOString(),
            };
            if (idx >= 0) { const u = [...prev]; u[idx] = entry; return u; }
            return [...prev, entry];
          });
        }
        if (Array.isArray(payload.trailPoints) && payload.trailPoints.length > 0) {
          setRiderTrails((prev) => ({
            ...prev,
            [payload.userId]: [...(prev[payload.userId] || []), ...payload.trailPoints],
          }));
        }
      })
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.id)) return prev; // dedup
          return [...prev, payload as RideMessage];
        });
        if (payload.message_type === 'sos') setSosActive(true);
        if (payload.message_type === 'chat' || payload.message_type === 'preset') setNewMsgCount((c) => c + 1);

        // Feature G Requirement 4: Record delivery receipt and send ack back to group
        if (payload.id && user?.id) {
          const nowIso = new Date().toISOString();
          setDeliveryReceipts((prev) => {
            const list = prev[payload.id] || [];
            if (list.some((r) => r.userId === user.id)) return prev;
            return {
              ...prev,
              [payload.id]: [...list, { userId: user.id, userName, timestamp: nowIso }],
            };
          });

          // Send receipt to sender and convoy
          if (payload.user_id !== user.id) {
            channel.send({
              type: 'broadcast',
              event: 'message_ack',
              payload: {
                messageId: payload.id,
                userId: user.id,
                userName,
                timestamp: nowIso,
              },
            });
          }
        }
      })
      .on('broadcast', { event: 'message_ack' }, ({ payload }) => {
        if (!payload?.messageId || !payload?.userId) return;
        setDeliveryReceipts((prev) => {
          const list = prev[payload.messageId] || [];
          if (list.some((r) => r.userId === payload.userId)) return prev;
          return {
            ...prev,
            [payload.messageId]: [
              ...list,
              {
                userId: payload.userId,
                userName: payload.userName || 'Rider',
                timestamp: payload.timestamp || new Date().toISOString(),
              },
            ],
          };
        });
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
      .on('broadcast', { event: 'stop_prealert' }, ({ payload }) => {
        playAlertChime('chime');
        setToast(`⛽ Pre-alert: Approaching ${payload.stopName} in ${payload.distanceKm ? `${payload.distanceKm.toFixed(1)} km` : '2 km'} (~${payload.etaMinutes || 4} min) · Prepare to regroup!`);
        setTimeout(() => setToast(''), 4500);
      })
      .on('broadcast', { event: 'stop_arrival_alert' }, ({ payload }) => {
        playAlertChime('urgent');
        setToast(`🏁 Convoy reached ${payload.stopName}! (${payload.userName} is here)`);
        setTimeout(() => setToast(''), 4500);
      })
      .on('broadcast', { event: 'announcement' }, ({ payload }) => {
        setActiveAnnouncement(payload);
        playAlertChime('urgent');
        // Feature K Requirement 4: Members get the alert with a distinct vibration pattern
        if ('vibrate' in navigator) {
          navigator.vibrate(CAPTAIN_ALERT_VIBRATION_PATTERN);
        }
      })
      .on('broadcast', { event: 'route_deviation' }, ({ payload }) => {
        if (!payload || !payload.userId) return;
        playAlertChime('alert');
        setToast(`⚠️ Route Deviation: ${payload.userName} is ${formatOffRouteDistance(payload.distanceMeters)} off the route`);
        setTimeout(() => setToast(''), 4000);
        setDeviationTrackers((prev) => ({
          ...prev,
          [payload.userId]: {
            userId: payload.userId,
            userName: payload.userName,
            lat: payload.lat,
            lng: payload.lng,
            distanceMeters: payload.distanceMeters,
            firstOffRouteAt: Date.now() - ((payload.durationSeconds || 120) * 1000),
            durationSeconds: payload.durationSeconds || 120,
            isDeviated: true,
            lastEvaluatedAt: Date.now(),
          },
        }));
      })
      .on('broadcast', { event: 'route_restored' }, ({ payload }) => {
        if (!payload || !payload.userId) return;
        setDeviationTrackers((prev) => {
          if (!prev[payload.userId]) return prev;
          const updated = { ...prev };
          delete updated[payload.userId];
          return updated;
        });
        setToast(`✓ ${payload.userName} returned to the route`);
        setTimeout(() => setToast(''), 3000);
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
    setShowTellGroupSheet(false);
    await rideService.updateQuickStatus(sessionId, value).catch(() => {});
    // Broadcast status change so others see rider dot badge update instantly
    channelRef.current?.send({ type: 'broadcast', event: 'status', payload: { userId: user?.id, userName, quickStatus: value } });
    if (value) {
      const nowIso = new Date().toISOString();
      const result = await rideService.sendMessage(sessionId, { message: value, messageType: 'preset', userName }).catch(() => null);
      const msg: RideMessage = result?.message ?? {
        id: Date.now().toString(),
        user_id: user?.id || 'unknown',
        user_name: userName,
        message: value,
        message_type: 'preset',
        created_at: nowIso,
      };

      // Record sender delivery receipt immediately
      if (user?.id) {
        setDeliveryReceipts((prev) => ({
          ...prev,
          [msg.id]: [{ userId: user.id, userName, timestamp: nowIso }],
        }));
      }

      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });

      channelRef.current?.send({ type: 'broadcast', event: 'message', payload: msg });
      setToast(`✓ Sent preset "${value}" to group!`);
      setTimeout(() => setToast(''), 3000);
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
      playAlertChime('urgent');
      setToast(`🏁 Marked as arrived at ${pinnedStop.name}!`);
      setTimeout(() => setToast(''), 3500);

      channelRef.current?.send({
        type: 'broadcast',
        event: 'stop_arrival_alert',
        payload: { stopName: pinnedStop.name, userId: user.id, userName },
      });

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
    if ('vibrate' in navigator) {
      navigator.vibrate(CAPTAIN_SENT_VIBRATION_PATTERN);
    }

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

  const itineraryStops = (session?.itinerary ?? []).filter((s) => s.lat && s.lng);
  const routeCoords: [number, number][] = itineraryStops.map((s) => [s.lat as number, s.lng as number]);
  const defaultCenter: [number, number] = myLat && myLng ? [myLat, myLng] : (routeCoords[0] ?? [20.5937, 78.9629]);

  const activeRoute = useMemo(
    () => (osrmRoute.length > 1 ? osrmRoute : routeCoords),
    [osrmRoute, routeCoords]
  );

  const totalRouteDist = useMemo(() => getRouteTotalDistance(activeRoute), [activeRoute]);

  const myFreshness = getFreshness(myLastUpdatedRef.current ?? (myLat ? new Date().toISOString() : null));

  // Feature E2 & A: Compute freshness and planned route progress status for all riders
  const ridersWithFreshness: RiderRosterData[] = useMemo(() => {
    // 1. Calculate raw progress for all valid positions along activeRoute
    const progressMap: Record<string, { distanceAlong: number; percent: number; crossTrack: number }> = {};
    if (activeRoute.length >= 2) {
      if (myLat && myLng && user?.id) {
        const myProg = calculateRouteProgress([myLat, myLng], activeRoute, totalRouteDist);
        progressMap[user.id] = {
          distanceAlong: myProg.distanceAlongMeters,
          percent: myProg.progressPercent,
          crossTrack: myProg.crossTrackDistanceMeters,
        };
      }
      riders.forEach((r) => {
        if (r.user_id && r.lat && r.lng) {
          const prog = calculateRouteProgress([Number(r.lat), Number(r.lng)], activeRoute, totalRouteDist);
          progressMap[r.user_id] = {
            distanceAlong: prog.distanceAlongMeters,
            percent: prog.progressPercent,
            crossTrack: prog.crossTrackDistanceMeters,
          };
        }
      });
    }

    // 2. Reference progress: Captain's progress or current user's progress
    const captainId = session?.started_by;
    const refProgressMeters = (captainId && progressMap[captainId])
      ? progressMap[captainId].distanceAlong
      : (user?.id && progressMap[user.id])
        ? progressMap[user.id].distanceAlong
        : 0;

    return riders.map((r, i) => {
      const isMe = r.user_id === user?.id;
      const freshness = isMe ? myFreshness : getFreshness(r.updated_at);
      const isCaptain = session?.started_by === r.user_id;
      const dist = myLat && myLng && r.lat && r.lng ? haversineKm(myLat, myLng, Number(r.lat), Number(r.lng)) : null;
      const color = RIDER_COLORS[i % RIDER_COLORS.length];
      const prog = r.user_id ? progressMap[r.user_id] : null;

      // Feature C deviation alert status
      const isOffRoute = r.user_id ? !!deviationTrackers[r.user_id]?.isDeviated : false;

      // Feature E2 route status (Ahead, on plan, behind, off route, unknown)
      const routeStatus = prog
        ? evaluateRiderRouteStatus({
            riderProgressMeters: prog.distanceAlong,
            refProgressMeters,
            crossTrackMeters: prog.crossTrack,
            isOffRouteAlert: isOffRoute,
            isStaleOrUnknown: freshness.isStale || freshness.isUnknown,
            progressPercent: prog.percent,
          })
        : undefined;

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
        routeStatus,
      };
    });
  }, [riders, user?.id, myFreshness, session?.started_by, myLat, myLng, activeRoute, totalRouteDist, deviationTrackers]);

  // Feature E2: Data prepared for RouteProgressStrip
  const ridersForProgressStrip: RouteProgressRider[] = useMemo(() => {
    return ridersWithFreshness
      .filter((r) => r.lat && r.lng && r.routeStatus)
      .map((r) => ({
        userId: r.userId,
        userName: r.userName,
        isMe: r.isMe,
        isCaptain: r.isCaptain,
        color: r.color,
        progressPercent: r.routeStatus!.progressPercent,
        distanceAlongMeters: r.routeStatus!.distanceAlongMeters,
        routeStatus: r.routeStatus!,
      }));
  }, [ridersWithFreshness]);

  const stopsForProgressStrip: RouteMilestoneStop[] = useMemo(() => {
    if (!activeRoute || activeRoute.length < 2) return [];
    return itineraryStops.map((stop) => {
      const prog = calculateRouteProgress([stop.lat as number, stop.lng as number], activeRoute, totalRouteDist);
      return {
        id: stop.id,
        place: stop.place,
        progressPercent: prog.progressPercent,
        itemType: stop.item_type,
      };
    });
  }, [itineraryStops, activeRoute, totalRouteDist]);

  // Stale and unknown riders (for alert banner)
  const staleRiders = useMemo(() => {
    return ridersWithFreshness.filter((r) => !r.isMe && (r.freshness.isStale || r.freshness.isUnknown));
  }, [ridersWithFreshness]);

  // Feature F+I & J: Stop approach evaluation (pre-alert, arrival detection & missed stop)
  const distToPinnedStop = useMemo(() => {
    if (!pinnedStop || !myLat || !myLng) return null;
    return haversineKm(myLat, myLng, pinnedStop.lat, pinnedStop.lng);
  }, [pinnedStop, myLat, myLng]);

  // Track minimum distance approached to pinned stop (for missed stop detection)
  useEffect(() => {
    if (distToPinnedStop != null && distToPinnedStop < minDistToPinnedStopKmRef.current) {
      minDistToPinnedStopKmRef.current = distToPinnedStop;
    }
  }, [distToPinnedStop]);

  // Stop & rider progress along active route
  const pinnedStopRouteProgressMeters = useMemo(() => {
    if (!pinnedStop || activeRoute.length < 2) return null;
    const prog = calculateRouteProgress([pinnedStop.lat, pinnedStop.lng], activeRoute, totalRouteDist);
    return prog.distanceAlongMeters;
  }, [pinnedStop, activeRoute, totalRouteDist]);

  const myRouteProgressMeters = useMemo(() => {
    if (!myLat || !myLng || activeRoute.length < 2) return null;
    const prog = calculateRouteProgress([myLat, myLng], activeRoute, totalRouteDist);
    return prog.distanceAlongMeters;
  }, [myLat, myLng, activeRoute, totalRouteDist]);

  // Format riders for StopDetailSheet (Feature J arrival status)
  const ridersForStopDetail = useMemo(() => {
    return ridersWithFreshness.map((r) => {
      const arrival = ridersArrival[r.userId];
      const distKm = pinnedStop ? haversineKm(r.lat, r.lng, pinnedStop.lat, pinnedStop.lng) : null;

      const riderProg = (activeRoute.length > 1)
        ? calculateRouteProgress([r.lat, r.lng], activeRoute, totalRouteDist).distanceAlongMeters
        : null;

      const isMissed = Boolean(
        arrival?.status !== 'arrived' &&
        riderProg != null &&
        pinnedStopRouteProgressMeters != null &&
        pinnedStopRouteProgressMeters > 0 &&
        riderProg > pinnedStopRouteProgressMeters + 350
      );

      return {
        userId: r.userId,
        userName: r.userName,
        isMe: r.isMe,
        freshness: r.freshness,
        distanceKm: distKm,
        speedKmh: r.speedKmh,
        arrivalStatus: (arrival?.status ?? (isMissed ? 'missed' : 'en_route')) as 'arrived' | 'en_route' | 'departed' | 'missed',
        arrivedAt: arrival?.arrivedAt,
        isMissed,
      };
    });
  }, [ridersWithFreshness, ridersArrival, pinnedStop, activeRoute, totalRouteDist, pinnedStopRouteProgressMeters]);

  const isMeArrived = useMemo(() => {
    return user?.id ? ridersArrival[user.id]?.status === 'arrived' : false;
  }, [user?.id, ridersArrival]);

  // Feature J: Auto-detect arrival zone (< 200m)
  const isArrivalZone = useMemo(() => {
    if (isMeArrived || arrivalOfferDismissed || distToPinnedStop == null) return false;
    return detectArrivalZone(distToPinnedStop, 0.2);
  }, [isMeArrived, arrivalOfferDismissed, distToPinnedStop]);

  // Feature J: Auto-detect missed stop (> 350m past stop)
  const isMissedStop = useMemo(() => {
    if (isMeArrived || missedPromptDismissed) return false;
    return detectMissedStop({
      riderProgressMeters: myRouteProgressMeters ?? undefined,
      stopProgressMeters: pinnedStopRouteProgressMeters ?? undefined,
      distanceToStopKm: distToPinnedStop,
      minDistanceRecordedKm: minDistToPinnedStopKmRef.current,
      isArrived: isMeArrived,
      isDismissed: missedPromptDismissed,
      thresholdMeters: 350,
    });
  }, [isMeArrived, missedPromptDismissed, myRouteProgressMeters, pinnedStopRouteProgressMeters, distToPinnedStop]);

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

  const stopApproachEval = useMemo(() => {
    return evaluateStopApproach(distToPinnedStop, mySpeedKmh, isMeArrived);
  }, [distToPinnedStop, mySpeedKmh, isMeArrived]);

  const [dismissStopApproach, setDismissStopApproach] = useState(false);
  const preAlertTriggeredRef = useRef(false);

  useEffect(() => {
    if (!pinnedStop) {
      preAlertTriggeredRef.current = false;
      setDismissStopApproach(false);
      return;
    }
    // Pre-alert detection (2 km / 5 min threshold)
    if (stopApproachEval.isApproaching && !preAlertTriggeredRef.current) {
      preAlertTriggeredRef.current = true;
      playAlertChime('chime');
      setToast(`⛽ Pre-alert: Approaching ${pinnedStop.name} in ${distToPinnedStop?.toFixed(1) ?? '2'} km · Prepare to regroup!`);
      setTimeout(() => setToast(''), 4500);

      channelRef.current?.send({
        type: 'broadcast',
        event: 'stop_prealert',
        payload: {
          stopName: pinnedStop.name,
          distanceKm: distToPinnedStop,
          etaMinutes: stopApproachEval.etaMinutes,
        },
      });
    }
  }, [stopApproachEval.isApproaching, pinnedStop, distToPinnedStop, stopApproachEval.etaMinutes]);

  // Feature C: Evaluate route deviation for all riders against active route
  useEffect(() => {
    if (!activeRoute || activeRoute.length < 2) return;

    setDeviationTrackers((prev) => {
      const next = { ...prev };
      let changed = false;

      // 1. Evaluate current user
      if (user?.id && myLat && myLng) {
        const myTracker = evaluateRiderDeviation(
          { userId: user.id, userName, lat: myLat, lng: myLng },
          activeRoute,
          prev[user.id]
        );
        // Requirement 2 & 3: Check if crossed threshold (> 300m for 2min)
        if (myTracker.isDeviated && !prev[user.id]?.isDeviated) {
          channelRef.current?.send({
            type: 'broadcast',
            event: 'route_deviation',
            payload: {
              userId: user.id,
              userName,
              distanceMeters: Math.round(myTracker.distanceMeters),
              durationSeconds: myTracker.durationSeconds,
              lat: myLat,
              lng: myLng,
              timestamp: new Date().toISOString(),
            },
          });
          playAlertChime('alert');
          setToast(`⚠️ You are ${formatOffRouteDistance(myTracker.distanceMeters)} off the planned route`);
          setTimeout(() => setToast(''), 4000);
        } else if (!myTracker.isDeviated && prev[user.id]?.isDeviated) {
          // Requirement 5: Alert clears when back on line
          channelRef.current?.send({
            type: 'broadcast',
            event: 'route_restored',
            payload: { userId: user.id, userName },
          });
        }
        next[user.id] = myTracker;
        changed = true;
      }

      // 2. Evaluate all other riders in convoy
      riders.forEach((r) => {
        if (!r.user_id || r.user_id === user?.id || !r.lat || !r.lng) return;
        const rTracker = evaluateRiderDeviation(
          { userId: r.user_id, userName: r.user_name || 'Rider', lat: Number(r.lat), lng: Number(r.lng) },
          activeRoute,
          prev[r.user_id]
        );
        if (rTracker.isDeviated && !prev[r.user_id]?.isDeviated) {
          playAlertChime('alert');
          setToast(`⚠️ ${r.user_name || 'Rider'} is ${formatOffRouteDistance(rTracker.distanceMeters)} off the route`);
          setTimeout(() => setToast(''), 4000);
        }
        next[r.user_id] = rTracker;
        changed = true;
      });

      return changed ? next : prev;
    });
  }, [activeRoute, myLat, myLng, riders, user?.id, userName]);

  // Active deviation alerts
  const activeDeviationAlerts: OffRouteAlert[] = useMemo(() => {
    if (!activeRoute || activeRoute.length < 2) return [];
    return Object.values(deviationTrackers)
      .filter((t) => t.isDeviated && !dismissedDeviations.has(t.userId))
      .map((t) => {
        const { nearestPoint } = getMinDistanceToRoute(t.lat, t.lng, activeRoute);
        return {
          userId: t.userId,
          userName: t.userName,
          lat: t.lat,
          lng: t.lng,
          distanceMeters: t.distanceMeters,
          durationSeconds: t.durationSeconds,
          firstOffRouteAt: t.firstOffRouteAt || Date.now(),
          nearestRoutePoint: nearestPoint,
        };
      })
      .sort((a, b) => b.distanceMeters - a.distanceMeters);
  }, [deviationTrackers, dismissedDeviations, activeRoute]);

  // Requirement 4: Captain acts -> tap Regroup sends announcement to everyone
  const handleRegroup = useCallback(
    (alert: OffRouteAlert) => {
      handleSendAnnouncement({
        title: 'Regroup Convoy',
        message: `${alert.userName} is ${formatOffRouteDistance(alert.distanceMeters)} off the route. Slow down or wait at next junction.`,
        icon: '🛑',
        urgency: 'high',
      });
      setToast(`📢 Regroup announcement broadcasted to convoy!`);
      setTimeout(() => setToast(''), 3000);
    },
    [handleSendAnnouncement]
  );

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
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', backgroundColor: '#111316', fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', overflow: 'hidden' }}>
      {/* Dynamic Dark Style for Map & Elements */}
      <style>{`
        .warm-map-container,
        .leaflet-container {
          background-color: #111316 !important;
          width: 100%;
          height: 100%;
        }
        .warm-map-container .leaflet-tile-pane {
          filter: invert(100%) hue-rotate(180deg) brightness(85%) contrast(90%);
        }
        .warm-map-container .leaflet-control-attribution {
          display: none;
        }
      `}</style>

      {/* SOS Banner */}
      {sosActive && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, background: '#DC2626', color: '#FFFFFF', padding: '12px 16px', textAlign: 'center', fontWeight: 800, fontSize: 14 }}>
          🆘 SOS ALERT — A rider needs help!
          <button onClick={() => setSosActive(false)} style={{ marginLeft: 12, background: 'rgba(255,255,255,0.25)', border: 'none', color: '#FFFFFF', borderRadius: 6, padding: '2px 10px', cursor: 'pointer', fontWeight: 700 }}>Dismiss</button>
        </div>
      )}

      {/* Header — Matte Obsidian Dark matching Mockup */}
      <div style={{
        backgroundColor: '#111316',
        padding: '14px 18px 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexShrink: 0,
        marginTop: sosActive ? 48 : 0,
      }}>
        {/* Left: Clean Minimal Back Arrow + Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'none',
              border: 'none',
              color: '#F1EFEA',
              fontSize: 22,
              cursor: 'pointer',
              padding: 0,
              fontWeight: 800,
              lineHeight: 1,
            }}
            title="Leave Ride Screen"
          >
            ←
          </button>
          <div style={{ minWidth: 0 }}>
            <h1 style={{
              color: '#F1EFEA',
              fontWeight: 900,
              fontSize: 22,
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              letterSpacing: -0.5,
            }}>
              {tab === 'chat' ? 'Trip chat' : tab === 'plan' ? 'Itinerary & Plan' : tab === 'discover' ? 'Discover' : tab === 'riders' ? 'Convoy Roster' : tab === 'nav' ? 'Directions' : tab === 'me' ? 'Me · Settings' : 'Group ride'}
            </h1>
          </div>
        </div>

        {/* Right: Subtitle & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {tab !== 'map' && (
            <span style={{
              color: '#9D9C9A',
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}>
              {tab === 'chat' ? 'Linked to itinerary' : tab === 'plan' ? 'Itinerary & Help' : tab === 'me' ? 'Ride settings' : ''}
            </span>
          )}

          {/* Quick Nearby Help */}
          <button
            type="button"
            onClick={() => setShowNearbyHelp(true)}
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              backgroundColor: '#1B1E23',
              border: '1.5px solid #2A2E35',
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Verified Nearby Help (Fuel, Repair, Food, Rest)"
          >
            🛠️
          </button>

          {/* Feature K: Captain-only announcement control on Ride tab */}
          {isLead && (
            <button
              type="button"
              onClick={() => setShowAnnouncementModal(true)}
              style={{
                padding: '4px 10px',
                borderRadius: 20,
                backgroundColor: 'rgba(240, 194, 58, 0.15)',
                border: '1.5px solid #F0C23A',
                color: '#F0C23A',
                fontSize: 12,
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                boxShadow: '0 2px 8px rgba(240, 194, 58, 0.25)',
              }}
              title="Captain announcement sheet (Feature K)"
            >
              <span>👑</span>
              <span>Announce</span>
            </button>
          )}

          {/* Discreet Emergency SOS */}
          <button
            type="button"
            onClick={sendSOS}
            style={{
              padding: '5px 10px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1.5px solid #EF4444',
              color: '#EF4444',
              borderRadius: 16,
              fontSize: 11,
              fontWeight: 900,
              cursor: 'pointer',
            }}
            title="Emergency SOS"
          >
            SOS
          </button>

          {/* End / Leave Ride */}
          {isLead && (
            <button
              type="button"
              onClick={handleEndRide}
              disabled={endingRide}
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                backgroundColor: '#1B1E23',
                border: '1.5px solid #2A2E35',
                color: '#EF4444',
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
          )}
        </div>
      </div>

      {/* Dedicated Expedition Route Strip for Mobile Users View */}
      {session?.trips?.title && tab === 'map' && (
        <div style={{
          backgroundColor: '#1B1E23',
          border: '1.5px solid #2A2E35',
          borderRadius: 14,
          margin: '2px 16px 8px',
          padding: '7px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 22,
              height: 22,
              borderRadius: 6,
              backgroundColor: 'rgba(240, 194, 58, 0.15)',
              color: '#F0C23A',
              fontSize: 12,
              flexShrink: 0,
            }}>
              🗺️
            </span>
            <span style={{
              fontSize: 13,
              fontWeight: 800,
              color: '#F1EFEA',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              letterSpacing: -0.2,
            }}>
              {session.trips.title}
            </span>
          </div>

          <span style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#9D9C9A',
            backgroundColor: '#111316',
            border: '1px solid #2A2E35',
            padding: '2px 8px',
            borderRadius: 999,
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}>
            Day 2 · 62 km to go
          </span>
        </div>
      )}

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

      {/* Feature K: Captain Announcement Alert Card (Members see the announcement as an alert) */}
      {activeAnnouncement && (
        <div style={{
          margin: '0 16px 8px 16px',
          padding: '12px 14px',
          borderRadius: 18,
          backgroundColor: '#1B1E23',
          border: activeAnnouncement.urgency === 'high' ? '1.5px solid #EF4444' : '1.5px solid #F0C23A',
          boxShadow: activeAnnouncement.urgency === 'high' ? '0 4px 20px rgba(239, 68, 68, 0.35)' : '0 4px 20px rgba(240, 194, 58, 0.35)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
          zIndex: 35,
          animation: 'slideDown 0.25s ease-out',
        }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: activeAnnouncement.urgency === 'high' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(240, 194, 58, 0.15)',
            border: activeAnnouncement.urgency === 'high' ? '1px solid #EF4444' : '1px solid #F0C23A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            flexShrink: 0,
          }}>
            {activeAnnouncement.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{
                fontSize: 9,
                fontWeight: 900,
                color: activeAnnouncement.urgency === 'high' ? '#EF4444' : '#F0C23A',
                letterSpacing: 0.8,
                textTransform: 'uppercase',
              }}>
                📢 CAPTAIN ANNOUNCEMENT
              </span>
              <span style={{ fontSize: 9.5, color: '#9D9C9A', fontWeight: 600 }}>
                {activeAnnouncement.timestamp}
              </span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#F1EFEA', lineHeight: 1.2 }}>
              {activeAnnouncement.title}
            </div>
            {activeAnnouncement.message && (
              <div style={{ fontSize: 11.5, color: '#9D9C9A', fontWeight: 600, marginTop: 2, lineHeight: 1.3 }}>
                {activeAnnouncement.message}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setActiveAnnouncement(null)}
            style={{
              padding: '6px 12px',
              backgroundColor: '#111316',
              border: '1.5px solid #2A2E35',
              borderRadius: 10,
              color: '#F1EFEA',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Got it ✓
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

      {/* Feature B: Offline Position Queue Ride Banner ("No signal. Your position is saved and will sync.") */}
      <OfflineSignalBanner
        isOnline={queueState.isOnline}
        pendingCount={queueState.pendingCount}
        isSyncing={queueState.isSyncing}
        justSynced={justSynced}
        onForceSync={syncPendingBatch}
      />

      {/* Feature C: Route-deviation alert card */}
      <RouteDeviationCard
        alerts={activeDeviationAlerts}
        isCaptain={isLead}
        currentUserId={user?.id}
        onRegroup={handleRegroup}
        onFocusRider={(lat, lng) => {
          setFocusTarget([lat, lng]);
          setFollowing(false);
          setToast('Focused on off-route rider');
        }}
        onNavigateBack={(lat, lng) => {
          setNavTarget({ name: 'Planned Route Rejoin Point', lat, lng });
          setShowNavModal(true);
        }}
        onDismiss={(userId) => {
          setDismissedDeviations((prev) => new Set([...prev, userId]));
        }}
      />

      {/* Feature D: Battery-saver mode note on Ride tab */}
      <BatterySaverNote
        enabled={batterySaver}
        onOpenSettings={() => setTab('me')}
      />

      {/* Feature J: Arrival detection offer (<200m) */}
      {isArrivalZone && pinnedStop && !isMeArrived && !arrivalOfferDismissed && (
        <ArrivalOfferBanner
          stopName={pinnedStop.name}
          distanceMeters={(distToPinnedStop ?? 0.1) * 1000}
          onConfirmArrival={() => handleToggleMyArrival(true)}
          onDismiss={() => setArrivalOfferDismissed(true)}
        />
      )}

      {/* Feature J: Missed stop prompt (>350m past stop) */}
      {isMissedStop && pinnedStop && !isMeArrived && !missedPromptDismissed && (
        <MissedStopPromptCard
          pinnedStop={pinnedStop}
          onConfirmStopped={() => handleToggleMyArrival(true)}
          onSkipStop={() => setMissedPromptDismissed(true)}
          onTurnBack={() => {
            setNavTarget({ name: pinnedStop.name, lat: pinnedStop.lat, lng: pinnedStop.lng });
            setShowNavModal(true);
            setMissedPromptDismissed(true);
          }}
        />
      )}

      {/* Feature F+I: Stop Pre-Alert & Arrival Card */}
      {!dismissStopApproach && pinnedStop && (stopApproachEval.isApproaching || isMeArrived) && (
        <StopApproachCard
          pinnedStop={pinnedStop}
          stage={stopApproachEval.stage}
          distanceKm={distToPinnedStop}
          etaFormatted={stopApproachEval.etaFormatted}
          arrivedCount={arrivedCount}
          totalCount={ridersWithFreshness.length}
          isMeArrived={isMeArrived}
          onToggleMyArrival={handleToggleMyArrival}
          onOpenDetail={() => setShowStopDetailSheet(true)}
          onOpenNavigation={(target) => {
            setNavTarget(target);
            setShowNavModal(true);
          }}
          onDismiss={() => setDismissStopApproach(true)}
        />
      )}

      {/* Map tab — always rendered, shown/hidden via visibility so Leaflet doesn't break */}
      <div style={{
        flex: tab === 'map' ? 1 : 0,
        overflow: 'hidden',
        display: tab === 'map' ? 'flex' : 'none',
        flexDirection: 'column',
        position: 'relative',
        backgroundColor: '#111316',
        minHeight: 0,
      }}>
        {/* Feature E2: Planned Route Progress Strip along planned line */}
        {splitView && activeRoute.length > 1 && (
          <RouteProgressStrip
            routeTitle={session?.trips?.title ? `${session.trips.title}` : 'Planned Route Progress'}
            totalDistanceMeters={totalRouteDist}
            riders={ridersForProgressStrip}
            stops={stopsForProgressStrip}
            onSelectRider={(uid) => {
              const found = ridersWithFreshness.find((r) => r.userId === uid);
              if (found && found.lat && found.lng) {
                setFollowing(false);
                setFocusTarget([found.lat, found.lng]);
              }
            }}
            onSelectStop={(stopId) => {
              const found = itineraryStops.find((s) => s.id === stopId);
              if (found && found.lat && found.lng) {
                setFollowing(false);
                setFocusTarget([found.lat as number, found.lng as number]);
              }
            }}
          />
        )}

        {/* Map Section (Card style in Split View, 100% edge-to-edge in Full Map) */}
        <div className="warm-map-container" style={{
          flex: splitView ? '0 0 38%' : '1 1 auto',
          height: splitView ? '38%' : '100%',
          minHeight: 0,
          margin: splitView ? '2px 16px 8px' : '0',
          borderRadius: splitView ? 20 : 0,
          border: splitView ? '1.5px solid #2A2E35' : 'none',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          backgroundColor: '#111316',
          boxShadow: splitView ? '0 4px 20px rgba(0, 0, 0, 0.35)' : 'none',
        }}>
          {gpsError && (
            <div style={{
              position: 'absolute',
              inset: 0,
              zIndex: 2000,
              backgroundColor: '#111316',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '24px 20px 28px',
              boxSizing: 'border-box',
            }}>
              <div>
                {/* Status Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#9D9C9A', fontSize: 13, fontWeight: 700, marginBottom: 28 }}>
                  <span>9:41</span>
                  <span>5G</span>
                </div>

                {/* Brand Header matching mockup: ■ PAYANAM */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
                  <div style={{ width: 12, height: 12, backgroundColor: '#F0C23A', borderRadius: 2 }} />
                  <span style={{ color: '#F1EFEA', fontWeight: 900, fontSize: 18, letterSpacing: 1.5 }}>PAYANAM</span>
                </div>

                {/* Step Card matching mockup */}
                <div style={{
                  backgroundColor: '#1B1E23',
                  border: '1.5px solid #2A2E35',
                  borderRadius: 20,
                  padding: '22px 20px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#9D9C9A', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
                    STEP 2 OF 3
                  </div>
                  <h3 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 10px', color: '#F1EFEA', letterSpacing: -0.3 }}>
                    Live trip tracking
                  </h3>
                  <p style={{ fontSize: 14, color: '#9D9C9A', lineHeight: 1.45, margin: 0 }}>
                    We use your location only while a trip is active, so your group can see where you are.
                  </p>
                </div>
              </div>

              {/* Fixed Bottom Buttons matching mockup */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
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
                    width: '100%',
                    padding: '16px',
                    backgroundColor: '#F0C23A',
                    color: '#111316',
                    border: 'none',
                    borderRadius: 14,
                    fontWeight: 900,
                    fontSize: 16,
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(240, 194, 58, 0.25)',
                    textAlign: 'center',
                  }}
                >
                  Allow location
                </button>
                <button
                  type="button"
                  onClick={() => setGpsError('')}
                  style={{
                    width: '100%',
                    padding: '16px',
                    backgroundColor: '#1B1E23',
                    color: '#F1EFEA',
                    border: '1.5px solid #2A2E35',
                    borderRadius: 14,
                    fontWeight: 800,
                    fontSize: 15,
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  Not now
                </button>
              </div>
            </div>
          )}

          {/* View Mode Toggle: Map + Roster vs Full Map */}
          <button
            type="button"
            onClick={() => setSplitView(!splitView)}
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              zIndex: 1000,
              backgroundColor: '#1B1E23',
              border: '1.5px solid #2A2E35',
              color: '#F1EFEA',
              borderRadius: 20,
              padding: '6px 14px',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
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
                bottom: splitView ? 12 : (pinnedStop ? 115 : 20),
                right: 12,
                zIndex: 1000,
                backgroundColor: '#1B1E23',
                border: '2px solid #F0C23A',
                color: '#F0C23A',
                borderRadius: '50%',
                width: 38,
                height: 38,
                fontSize: 18,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.4)',
              }}
              title="Re-center on me"
            >
              📍
            </button>
          )}

          {/* Feature G: One-tap Tell group floating button on Ride tab */}
          {!splitView && !pinnedStop && (
            <button
              type="button"
              onClick={() => setShowTellGroupSheet(true)}
              style={{
                position: 'absolute',
                bottom: 20,
                left: 12,
                zIndex: 1000,
                backgroundColor: '#F0C23A',
                color: '#111316',
                border: 'none',
                borderRadius: 24,
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 4px 18px rgba(0, 0, 0, 0.4)',
              }}
              title="Tell group presets"
            >
              <span>📢</span>
              <span>Tell group</span>
            </button>
          )}

          {/* Wake lock indicator */}
          {wakeLockActive && (
            <div style={{
              position: 'absolute',
              top: 10,
              right: 10,
              zIndex: 999,
              backgroundColor: '#1B1E23',
              border: '1.5px solid #10B981',
              color: '#10B981',
              fontSize: 11,
              fontWeight: 800,
              padding: '5px 10px',
              borderRadius: 20,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
            }}>
              🔆 Screen on
            </div>
          )}

          <MapContainer center={defaultCenter} zoom={18} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            {/* Auto-invalidates size whenever splitView toggles so tiles cover 100% of screen */}
            <MapResizer splitView={splitView} />

            {/* Free OpenStreetMap tiles rendered in Dark Mode via CSS filter (zero watermarks / zero API keys) */}
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            {myLat && myLng && (
              <MapFollow lat={myLat} lng={myLng} following={following} focusTarget={focusTarget} onDrag={() => { setFollowing(false); setFocusTarget(null); }} />
            )}
            {/* Road-following route (OSRM): Amber dashed route line matching mockup */}
            {(osrmRoute.length > 1 ? osrmRoute : routeCoords).length > 1 && (
              <Polyline positions={osrmRoute.length > 1 ? osrmRoute : routeCoords} color="#F0C23A" weight={5} dashArray="8, 8" opacity={0.95} />
            )}

            {/* Feature B: Rider recorded breadcrumb trails (Group map catches up) */}
            {Object.entries(riderTrails).map(([rId, trailPts]) => {
              if (!trailPts || trailPts.length < 2) return null;
              const rIdx = riders.findIndex((r) => r.user_id === rId);
              const trailColor = rId === user?.id ? '#10B981' : (rIdx >= 0 ? RIDER_COLORS[rIdx % RIDER_COLORS.length] : '#F0C23A');
              return (
                <Polyline
                  key={`trail-${rId}`}
                  positions={trailPts}
                  pathOptions={{
                    color: trailColor,
                    weight: rId === user?.id ? 4 : 3,
                    opacity: 0.65,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              );
            })}
            {/* Itinerary stop markers along planned line (Feature E2) */}
            {itineraryStops.map((stop) => (
              <Marker
                key={stop.id}
                position={[stop.lat as number, stop.lng as number]}
                icon={makeStopIcon(stop.place, stop.item_type, stop.order_index)}
              />
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
            {/* Other riders — dynamic Last-seen & Route Progress marker (Feature A + E2) */}
            {ridersWithFreshness.filter((r) => !r.isMe).map((r) => (
              <Marker
                key={r.userId}
                position={[r.lat, r.lng]}
                icon={createRiderMarkerIcon(
                  r.userName,
                  r.color,
                  r.quickStatus ?? '',
                  r.freshness,
                  r.isCaptain,
                  r.routeStatus
                )}
              />
            ))}
          </MapContainer>
        </div>

        {/* In Split View: Alert Banner + Rider Roster (Mockup Screen 1) */}
        {splitView && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#111316' }}>
            {/* Stale Riders Warning Banner */}
            <StaleRidersAlertBanner
              staleCount={staleRiders.length}
              staleRiderNames={staleRiders.map((r) => r.userName)}
              onClick={() => setTab('riders')}
            />

            {/* Rider Roster List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 2px 8px' }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: '#9D9C9A', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                  Convoy Roster ({ridersWithFreshness.length})
                </span>
                <span style={{ fontSize: 11, color: '#10B981', fontWeight: 800 }}>
                  ● {ridersWithFreshness.filter(r => r.freshness.isLive).length} LIVE
                </span>
              </div>

              {ridersWithFreshness.length === 0 && (
                <p style={{ color: '#9D9C9A', textAlign: 'center', marginTop: 24, fontSize: 13 }}>
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
        {(splitView || pinnedStop) && (
          <div style={splitView ? {} : {
            position: 'absolute',
            bottom: 6,
            left: 0,
            right: 0,
            zIndex: 1000,
            pointerEvents: 'none',
          }}>
            <div style={{ pointerEvents: 'auto' }}>
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
          </div>
        )}
      </div>

      {/* Plan Tab (Mockup Screen 7: Trip detail · itinerary) */}
      {tab === 'plan' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#111316', padding: '12px 16px' }}>
          {/* Top Subheader Filter Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <span style={{ backgroundColor: '#F0C23A', color: '#111316', padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>
              ITINERARY
            </span>
            <span style={{ color: '#9D9C9A', padding: '6px 10px', fontSize: 11, fontWeight: 700 }}>
              PEOPLE
            </span>
            <span style={{ color: '#9D9C9A', padding: '6px 10px', fontSize: 11, fontWeight: 700 }}>
              MONEY
            </span>
            <button
              onClick={() => setShowNearbyHelp(true)}
              style={{ background: 'none', border: 'none', color: '#F0C23A', padding: '6px 10px', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
            >
              HELP ↗
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Itinerary Section Card */}
            <div style={{ backgroundColor: '#1B1E23', borderRadius: 18, border: '1.5px solid #2A2E35', padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 900, color: '#F1EFEA', letterSpacing: -0.2 }}>
                  {session?.trips?.title ?? 'Bengaluru to Kasaragod'}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#9D9C9A' }}>
                  3 days · {ridersWithFreshness.length} riders
                </span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 900, color: '#9D9C9A', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
                DAY 2 · HUBLI TO MANGALURU
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Hubli Origin */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #22262E' }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#F1EFEA' }}>07:30 Start from Hubli</span>
                    <div style={{ fontSize: 11, color: '#9D9C9A', marginTop: 2 }}>Origin waypoint</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#10B981', border: '1px solid #10B981', padding: '2px 6px', borderRadius: 4 }}>STARTED</span>
                </div>

                {/* Sagar Highway Dhaba */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #22262E' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#F1EFEA' }}>10:30 Sagar Highway Dhaba</span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#10B981', border: '1px solid #10B981', padding: '1px 6px', borderRadius: 4 }}>FROM CHAT</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#9D9C9A', marginTop: 2 }}>Chai & breakfast stop · 45 km marker</div>
                  </div>
                  {pinnedStop?.name === 'Sagar Highway Dhaba' ? (
                    <span style={{ fontSize: 10, fontWeight: 900, color: '#111316', backgroundColor: '#F0C23A', padding: '3px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span>📌</span> PINNED TARGET
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        handlePinStop({
                          name: 'Sagar Highway Dhaba',
                          lat: 14.1670,
                          lng: 75.0400,
                          type: 'meal',
                          dayNumber: 2,
                        }, false);
                        setTab('map');
                      }}
                      style={{ fontSize: 11, fontWeight: 800, color: '#F0C23A', backgroundColor: 'rgba(240, 194, 58, 0.12)', border: '1px solid #F0C23A', padding: '4px 10px', borderRadius: 8, cursor: 'pointer' }}
                    >
                      📌 Pin as next stop
                    </button>
                  )}
                </div>

                {/* Lunch, Udupi */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#F1EFEA' }}>13:00 Lunch, Udupi</span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#F0C23A', border: '1px solid #F0C23A', padding: '1px 6px', borderRadius: 4 }}>PROPOSED</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#9D9C9A', marginTop: 2 }}>Coastline regroup · 112 km marker</div>
                  </div>
                  {pinnedStop?.name === 'Lunch, Udupi' ? (
                    <span style={{ fontSize: 10, fontWeight: 900, color: '#111316', backgroundColor: '#F0C23A', padding: '3px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span>📌</span> PINNED TARGET
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        handlePinStop({
                          name: 'Lunch, Udupi',
                          lat: 13.3409,
                          lng: 74.7421,
                          type: 'meal',
                          dayNumber: 2,
                        }, false);
                        setTab('map');
                      }}
                      style={{ fontSize: 11, fontWeight: 800, color: '#F0C23A', backgroundColor: 'rgba(240, 194, 58, 0.12)', border: '1px solid #F0C23A', padding: '4px 10px', borderRadius: 8, cursor: 'pointer' }}
                    >
                      📌 Pin as next stop
                    </button>
                  )}
                </div>
              </div>

              {/* Add planned stop button */}
              <button
                type="button"
                onClick={() => setShowPinModal(true)}
                style={{ width: '100%', marginTop: 14, padding: '10px', backgroundColor: '#111316', border: '1.5px dashed #2A2E35', borderRadius: 10, color: '#F0C23A', fontWeight: 800, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <span>➕</span> Add planned stop to itinerary
              </button>
            </div>

            {/* Propose Card */}
            <div style={{ backgroundColor: '#1B1E23', borderRadius: 18, border: '1.5px solid #2A2E35', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#22262D', color: '#F1EFEA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, border: '1px solid #3A3F47' }}>
                  MR
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#F1EFEA' }}>Meera proposed</div>
                  <div style={{ fontSize: 12, color: '#9D9C9A' }}>Lunch at 13:30 instead</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => { setToast('Proposal accepted'); setTimeout(() => setToast(''), 2500); }}
                  style={{ flex: 1, padding: '10px', backgroundColor: '#F0C23A', color: '#111316', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => { setToast('Proposal declined'); setTimeout(() => setToast(''), 2500); }}
                  style={{ flex: 1, padding: '10px', backgroundColor: '#1B1E23', color: '#F1EFEA', border: '1.5px solid #2A2E35', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
                >
                  Decline
                </button>
              </div>
            </div>

            {/* Amenities Shortcut */}
            <button
              type="button"
              onClick={() => setShowNearbyHelp(true)}
              style={{ padding: '14px', backgroundColor: '#1B1E23', border: '1.5px solid #2A2E35', borderRadius: 14, color: '#F1EFEA', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
            >
              🛠️ View route-cached amenities (fuel, repair, food)
            </button>
          </div>
        </div>
      )}

      {/* Discover tab (Mockup Screen 8: Discover search) */}
      {tab === 'discover' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#111316', padding: '12px 16px' }}>
          {/* Search box */}
          <input
            type="text"
            readOnly
            value="Search: Bengaluru to Kasaragod"
            style={{ width: '100%', padding: '12px 16px', borderRadius: 16, border: '1.5px solid #2A2E35', backgroundColor: '#1B1E23', color: '#F1EFEA', fontSize: 14, fontWeight: 600, outline: 'none', marginBottom: 12 }}
          />

          {/* Tags */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#10B981', border: '1.5px solid #10B981', padding: '3px 8px', borderRadius: 6 }}>TWISTY</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#9D9C9A', border: '1.5px solid #2A2E35', padding: '3px 8px', borderRadius: 6 }}>3-5 DAYS</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#9D9C9A', border: '1.5px solid #2A2E35', padding: '3px 8px', borderRadius: 6 }}>MIXED</span>
          </div>

          {/* Route cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflowY: 'auto' }}>
            <div style={{ backgroundColor: '#1B1E23', border: '1.5px solid #2A2E35', borderRadius: 18, padding: '16px 18px' }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#F1EFEA' }}>Bengaluru to Kasaragod, 3 days</div>
              <div style={{ fontSize: 12, color: '#9D9C9A', marginTop: 4 }}>by Arjun · 412 copies · 4.7 from riders who finished</div>
              <div style={{ fontSize: 12, color: '#9D9C9A', marginTop: 2 }}>Stops: fuel 5 · food 9 · rest 2</div>
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => { setToast('Route copied to trips'); setTimeout(() => setToast(''), 2500); }}
                  style={{ padding: '9px 16px', backgroundColor: '#F0C23A', color: '#111316', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
                >
                  Copy to my trips
                </button>
                <button
                  type="button"
                  onClick={() => setTab('chat')}
                  style={{ padding: '9px 16px', backgroundColor: '#1B1E23', color: '#F1EFEA', border: '1.5px solid #2A2E35', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
                >
                  Message
                </button>
              </div>
            </div>

            <div style={{ backgroundColor: '#1B1E23', border: '1.5px solid #2A2E35', borderRadius: 18, padding: '16px 18px' }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#F1EFEA' }}>Coorg loop, 2 days</div>
              <div style={{ fontSize: 12, color: '#9D9C9A', marginTop: 4 }}>by Meera · 128 copies</div>
            </div>
          </div>
        </div>
      )}

      {/* Chat panel (Mockup Screen 4: Trip chat with Location Cards) */}
      {tab === 'chat' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#111316' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', marginTop: 40 }}>
                <p style={{ color: '#F1EFEA', fontWeight: 700, fontSize: 15 }}>No messages yet.</p>
                <p style={{ color: '#9D9C9A', fontSize: 13 }}>Share a stop or say hi to your group! 👋</p>
              </div>
            )}
            {messages.map((m) => {
              const isMe = m.user_id === user?.id;
              const isPreset = m.message_type === 'preset' || Boolean(getPresetInfo(m.message));
              const isStatus = m.message_type === 'status';
              const isAnnouncement = m.message_type === 'announcement';
              const isStopArrival = m.message_type === 'stop_arrival';

              // Feature G: One-tap status preset cards in trip chat
              if (isPreset) {
                return (
                  <PresetCard
                    key={m.id}
                    messageId={m.id}
                    senderId={m.user_id}
                    senderName={m.user_name}
                    messageText={m.message}
                    createdAt={m.created_at}
                    isMe={isMe}
                    deliveryReceipts={deliveryReceipts[m.id]}
                    allRiders={ridersWithFreshness.map((r) => ({ userId: r.userId, userName: r.userName }))}
                    isCaptain={session?.started_by === m.user_id || m.user_name?.toLowerCase().includes('captain')}
                  />
                );
              }

              if (isStatus || isStopArrival) {
                return (
                  <div key={m.id} style={{ textAlign: 'center', margin: '2px 0' }}>
                    <span style={{
                      fontSize: 11,
                      color: isStopArrival ? '#10B981' : '#9D9C9A',
                      background: isStopArrival ? 'rgba(16, 185, 129, 0.15)' : '#1B1E23',
                      border: isStopArrival ? '1.5px solid #10B981' : '1.5px solid #2A2E35',
                      padding: '3px 12px',
                      borderRadius: 14,
                      fontWeight: 700,
                    }}>
                      {m.message}
                    </span>
                  </div>
                );
              }

              if (isAnnouncement) {
                return (
                  <div key={m.id} style={{
                    background: 'rgba(240, 194, 58, 0.08)',
                    border: '1.5px solid #F0C23A',
                    borderRadius: 16,
                    padding: '12px 14px',
                    margin: '4px 0',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 900, color: '#F0C23A', textTransform: 'uppercase' }}>
                      <span>📢</span>
                      <span>Captain Announcement · {m.user_name}</span>
                    </div>
                    <div style={{ color: '#F1EFEA', fontSize: 14, fontWeight: 700, marginTop: 4 }}>
                      {m.message}
                    </div>
                  </div>
                );
              }

              // Check if message has location coordinates [lat,lng] or contains stop mention
              const coordMatch = m.message.match(/\[([0-9.-]+),\s*([0-9.-]+)\]/);
              const hasCoords = !!coordMatch;
              const parsedLat = coordMatch ? parseFloat(coordMatch[1]) : 0;
              const parsedLng = coordMatch ? parseFloat(coordMatch[2]) : 0;
              const hasStopMention = m.message_type === 'location_share' || hasCoords || m.message_type === 'stop_pin';

              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  {!isMe && (
                    <span style={{ fontSize: 12, color: '#9D9C9A', marginBottom: 4, fontWeight: 700 }}>
                      {m.user_name}
                    </span>
                  )}
                  <div style={{
                    maxWidth: '85%',
                    padding: '12px 16px',
                    borderRadius: 20,
                    background: isMe ? '#22262D' : '#1B1E23',
                    color: '#F1EFEA',
                    border: isMe ? '1.5px solid #F0C23A' : '1.5px solid #2A2E35',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                  }}>
                    <div style={{ fontSize: 14, lineHeight: 1.4 }}>{m.message}</div>

                    {/* Mockup Screen 4 Signature: Embedded Location Card with "Confirm as stop" Button */}
                    {hasStopMention && (
                      <div style={{
                        marginTop: 10,
                        padding: '12px 14px',
                        backgroundColor: '#111316',
                        border: '1.5px dashed #3A3F47',
                        borderRadius: 14,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 900, color: '#F1EFEA' }}>
                            {pinnedStop?.name ?? 'Sagar Highway Dhaba'}
                          </div>
                          <div style={{ fontSize: 11, color: '#9D9C9A', marginTop: 2 }}>
                            Shared {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · open in maps
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (parsedLat !== 0) {
                              handlePinStop({
                                name: `${m.user_name}'s Shared Stop`,
                                lat: parsedLat,
                                lng: parsedLng,
                                type: 'stop',
                              }, true);
                            } else if (pinnedStop) {
                              setToast('✓ Confirmed stop!');
                              setTimeout(() => setToast(''), 2000);
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '10px',
                            backgroundColor: '#F0C23A',
                            color: '#111316',
                            border: 'none',
                            borderRadius: 10,
                            fontWeight: 900,
                            fontSize: 13,
                            cursor: 'pointer',
                          }}
                        >
                          Confirm as stop
                        </button>
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 10, color: '#9D9C9A', marginTop: 3 }}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
            <div ref={chatBottomRef} />
          </div>

          {/* Quick Chat Pill Row & Feature G Presets */}
          <div style={{ padding: '6px 14px', background: '#111316', display: 'flex', gap: 8, borderTop: '1px solid #2A2E35', overflowX: 'auto' }}>
            <button
              type="button"
              onClick={() => setShowTellGroupSheet(true)}
              style={{
                padding: '6px 14px',
                background: 'rgba(240, 194, 58, 0.15)',
                border: '1.5px solid #F0C23A',
                borderRadius: 14,
                color: '#F0C23A',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>📢 Tell group</span>
            </button>
            {RIDER_STATUS_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => pickStatus(p.label)}
                style={{
                  padding: '6px 12px',
                  background: '#1B1E23',
                  border: '1.5px solid #2A2E35',
                  borderRadius: 14,
                  color: '#F1EFEA',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span>{p.icon}</span>
                <span>{p.label}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={handleShareCurrentLocation}
              style={{ padding: '6px 12px', background: '#1B1E23', border: '1.5px solid #2A2E35', borderRadius: 14, color: '#F1EFEA', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              📍 Share GPS
            </button>
            <button
              type="button"
              onClick={() => setShowPinModal(true)}
              style={{ padding: '6px 12px', background: '#1B1E23', border: '1.5px solid #2A2E35', borderRadius: 14, color: '#F1EFEA', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              📌 Propose Stop
            </button>
            <button
              type="button"
              onClick={() => setShowNearbyHelp(true)}
              style={{ padding: '6px 12px', background: '#1B1E23', border: '1.5px solid #2A2E35', borderRadius: 14, color: '#F1EFEA', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              🛠️ Nearby Amenities
            </button>
          </div>

          {/* Message Input matching mockup */}
          <div style={{ padding: '8px 14px 10px', background: '#111316', display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendChat()}
              placeholder="Message the trip group..."
              style={{ flex: 1, background: '#1B1E23', border: '1.5px solid #2A2E35', borderRadius: 24, padding: '11px 18px', color: '#F1EFEA', fontSize: 14, outline: 'none' }}
            />
            <button
              onClick={sendChat}
              disabled={sending || !chatInput.trim()}
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                backgroundColor: '#F0C23A',
                color: '#111316',
                border: 'none',
                fontWeight: 900,
                fontSize: 16,
                cursor: 'pointer',
                opacity: sending || !chatInput.trim() ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ➤
            </button>
          </div>
        </div>
      )}

      {/* Riders panel — Convoy Roster with Last-seen Freshness & Hollow Markers */}
      {tab === 'riders' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', backgroundColor: '#111316' }}>
          {/* Stale Riders Warning Banner */}
          <StaleRidersAlertBanner
            staleCount={staleRiders.length}
            staleRiderNames={staleRiders.map((r) => r.userName)}
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '8px 2px 10px' }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: '#9D9C9A', letterSpacing: 0.8, textTransform: 'uppercase' }}>
              Convoy Roster ({ridersWithFreshness.length})
            </span>
            <span style={{ fontSize: 11, color: '#10B981', fontWeight: 800 }}>
              ● {ridersWithFreshness.filter((r) => r.freshness.isLive).length} LIVE
            </span>
          </div>

          {ridersWithFreshness.length === 0 && (
            <p style={{ color: '#9D9C9A', textAlign: 'center', marginTop: 40, fontSize: 13 }}>
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
        <div style={{ flex: 1, overflowY: 'auto', background: '#111316', padding: '12px 16px' }}>
          {/* Quick Launch External Navigation Apps */}
          <div style={{ padding: '12px 16px', background: '#1B1E23', border: '1.5px solid #2A2E35', borderRadius: 16, marginBottom: 12, display: 'flex', gap: 10 }}>
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
                background: '#F0C23A',
                color: '#111316',
                border: 'none',
                borderRadius: 12,
                fontWeight: 900,
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <span>🧭 Open in Navigation App (Google / Apple / Waze)</span>
            </button>
          </div>

          {/* Route summary bar */}
          {navSteps.length > 0 && (() => {
            const totalDist = navSteps.reduce((a, s) => a + s.distance, 0);
            const totalSecs = navSteps.reduce((a, s) => a + s.duration, 0);
            const hrs = Math.floor(totalSecs / 3600);
            const mins = Math.round((totalSecs % 3600) / 60);
            return (
              <div style={{ background: '#1B1E23', padding: '14px 18px', border: '1.5px solid #2A2E35', borderRadius: 16, display: 'flex', gap: 24, marginBottom: 14 }}>
                <div>
                  <p style={{ color: '#F1EFEA', fontWeight: 800, fontSize: 16, margin: 0 }}>{fmtDist(totalDist)}</p>
                  <p style={{ color: '#9D9C9A', fontSize: 11, margin: 0 }}>total distance</p>
                </div>
                <div>
                  <p style={{ color: '#F1EFEA', fontWeight: 800, fontSize: 16, margin: 0 }}>{hrs > 0 ? `${hrs}h ${mins}m` : `${mins} min`}</p>
                  <p style={{ color: '#9D9C9A', fontSize: 11, margin: 0 }}>est. riding time</p>
                </div>
                <div>
                  <p style={{ color: '#F1EFEA', fontWeight: 800, fontSize: 16, margin: 0 }}>{navSteps.length}</p>
                  <p style={{ color: '#9D9C9A', fontSize: 11, margin: 0 }}>turns</p>
                </div>
              </div>
            );
          })()}
          {navSteps.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 16px' }}>
              <p style={{ fontSize: 32 }}>🗺️</p>
              <p style={{ color: '#9D9C9A', fontSize: 14 }}>Fetching route directions…</p>
            </div>
          )}
          {navSteps.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', borderBottom: '1px solid #2A2E35', background: i === 0 ? 'rgba(240, 194, 58, 0.08)' : 'transparent' }}>
              <div style={{ width: 36, height: 36, background: '#1B1E23', border: '1.5px solid #2A2E35', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                {stepIcon(step.instruction)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#F1EFEA', fontSize: 14, fontWeight: i === 0 ? 800 : 500, margin: 0 }}>{step.instruction}</p>
                <p style={{ color: '#9D9C9A', fontSize: 12, margin: '3px 0 0' }}>{fmtDist(step.distance)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Feature D: Me / Ride Settings Tab ("Lives on Me") */}
      {tab === 'me' && (
        <MeRideSettingsTab
          userName={userName}
          userEmail={user?.email}
          batterySaver={batterySaver}
          onToggleBatterySaver={handleToggleBatterySaver}
          wakeLockActive={wakeLockActive}
          onToggleWakeLock={() => setWakeLockActive((w) => !w)}
          onReturnToRide={() => setTab('map')}
          onEndRide={handleEndRide}
          isCaptain={isLead}
        />
      )}

      {/* Bottom tab bar — Scandinavian Editorial Pill Navigation */}
      <div style={{
        backgroundColor: '#111316',
        borderTop: '1.5px solid #2A2E35',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 18px 14px',
        flexShrink: 0,
      }}>
        {/* Tab 1: RIDE */}
        <button
          type="button"
          onClick={() => setTab('map')}
          style={tab === 'map' ? styles.activeNavPill : styles.inactiveNavBtn}
        >
          RIDE
        </button>

        {/* Tab 2: PLAN */}
        <button
          type="button"
          onClick={() => setTab('plan')}
          style={tab === 'plan' ? styles.activeNavPill : styles.inactiveNavBtn}
        >
          PLAN
        </button>

        {/* Tab 3: DISCOVER */}
        <button
          type="button"
          onClick={() => setTab('discover')}
          style={tab === 'discover' ? styles.activeNavPill : styles.inactiveNavBtn}
        >
          DISCOVER
        </button>

        {/* Tab 4: CHAT */}
        <button
          type="button"
          onClick={() => setTab('chat')}
          style={{
            ...(tab === 'chat' ? styles.activeNavPill : styles.inactiveNavBtn),
            position: 'relative',
          }}
        >
          CHAT
          {newMsgCount > 0 && tab !== 'chat' && (
            <span style={styles.chatUnreadDot} />
          )}
        </button>

        {/* Tab 5: ME */}
        <button
          type="button"
          onClick={() => setTab('me')}
          style={tab === 'me' ? styles.activeNavPill : styles.inactiveNavBtn}
        >
          ME
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
        mySpeedKmh={mySpeedKmh}
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
  activeNavPill: {
    backgroundColor: '#F0C23A',
    color: '#111316',
    fontWeight: 900,
    fontSize: 13,
    letterSpacing: 0.5,
    borderRadius: 999,
    padding: '8px 18px',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 2px 10px rgba(240, 194, 58, 0.25)',
    transition: 'all 0.15s ease',
  },
  inactiveNavBtn: {
    backgroundColor: 'transparent',
    color: '#9D9C9A',
    fontWeight: 800,
    fontSize: 13,
    letterSpacing: 0.5,
    border: 'none',
    cursor: 'pointer',
    padding: '8px 10px',
    transition: 'all 0.15s ease',
  },
  chatUnreadDot: {
    position: 'absolute',
    top: 4,
    right: 2,
    width: 7,
    height: 7,
    borderRadius: '50%',
    backgroundColor: '#F0C23A',
  },
  chatActionBtn: {
    padding: '4px 8px',
    background: '#1B1E23',
    border: '1px solid #2A2E35',
    borderRadius: 6,
    color: '#F0C23A',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  },
  chatQuickPill: {
    padding: '6px 12px',
    background: '#1B1E23',
    border: '1px solid #2A2E35',
    borderRadius: 14,
    color: '#9D9C9A',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
};
