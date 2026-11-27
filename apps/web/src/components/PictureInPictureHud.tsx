import Icon from './Icon';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { PinnedStopData } from './PinStopModal';
import { getPipPreferences, savePipPreferences } from '../utils/pipPreferences';

interface WebkitHTMLVideoElement extends HTMLVideoElement {
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitSetPresentationMode?: (mode: string) => void;
  webkitPresentationMode?: string;
}

interface WindowWithDocPiP extends Window {
  documentPictureInPicture?: {
    requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
  };
}

const HUD_WIDTH = 196;
const HUD_HEIGHT = 310;
const HUD_SCALE = 3; // 3x HiDPI (588 x 930) slim vertical cockpit for minimal map obstruction

export interface PipRiderData {
  userId: string;
  userName: string;
  speedKmh?: number;
  isCaptain?: boolean;
  isMe?: boolean;
  isLive?: boolean;
  isStale?: boolean;
  staleAgeLabel?: string;
  quickStatus?: string;
  distanceKm?: number;
  progressPercent?: number;
  distanceAlongMeters?: number;
  relativePosition?: 'ahead' | 'behind' | 'you';
  relativeDistanceMeters?: number;
}

export interface PictureInPictureHudProps {
  pinnedStop: PinnedStopData | null;
  distToPinnedStop: number | null;
  arrivedCount: number;
  totalRiders: number;
  riders: PipRiderData[];
  currentSpeedKmh: number;
  fuelRangeKm?: number | null;
  isOffRoute?: boolean;
  offRouteMeters?: number | null;
  sosActive?: boolean;
  activeAnnouncement?: { message: string; urgency?: string; icon?: string } | null;
  tripTitle?: string;
  onQuickStatus?: (status: string) => void;
  onFocusApp?: () => void;
  renderTrigger?: (props: { isPipActive: boolean; togglePip: () => void; isSupported: boolean }) => React.ReactNode;
  onPipStateChange?: (active: boolean) => void;
}

function formatDist(meters?: number): string {
  if (meters == null || isNaN(meters)) return '--';
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}k`;
}

function getCanvasStreamWithAudio(canvas: HTMLCanvasElement): MediaStream | null {
  if (typeof canvas.captureStream !== 'function') return null;
  try {
    const stream = canvas.captureStream(30);
    // Inject a silent audio track so Apple iOS WebKit media pipeline treats it as a full video/audio media stream
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        const osc = audioCtx.createOscillator();
        osc.frequency.value = 0; // 0 Hz (silence)
        const dest = audioCtx.createMediaStreamDestination();
        osc.connect(dest);
        osc.start();
        const silentTrack = dest.stream.getAudioTracks()[0];
        if (silentTrack) {
          stream.addTrack(silentTrack);
        }
      }
    } catch {
      // ignore audio context failures
    }
    return stream;
  } catch (err) {
    console.warn('[PiP HUD] Failed to capture canvas stream:', err);
    return null;
  }
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.rect(x, y, w, h);
  }
}

export const PictureInPictureHud: React.FC<PictureInPictureHudProps> = ({
  pinnedStop,
  distToPinnedStop,
  arrivedCount,
  totalRiders,
  riders,
  currentSpeedKmh,
  fuelRangeKm = null,
  isOffRoute = false,
  offRouteMeters = null,
  sosActive = false,
  activeAnnouncement = null,
  tripTitle = 'Payanam Convoy',
  onQuickStatus,
  onFocusApp,
  renderTrigger,
  onPipStateChange,
}) => {
  const [isPipActive, setIsPipActive] = useState(false);
  const [isFloatingInApp, setIsFloatingInApp] = useState(false);
  const [isCompact, setIsCompact] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [hudDockPosition, setHudDockPosition] = useState<'top' | 'bottom'>(
    () => getPipPreferences().dockPosition
  );
  const [nativePipAvailable, setNativePipAvailable] = useState(false);
  const isSupported = true; // Always supported via Native OS PiP or Floating In-App HUD!

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const docPipWindowRef = useRef<Window | null>(null);
  const docPipCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoOpenedRef = useRef(false);

  // Live state refs for 60 FPS loop
  const stateRef = useRef({
    pinnedStop,
    distToPinnedStop,
    arrivedCount,
    totalRiders,
    riders,
    currentSpeedKmh,
    fuelRangeKm,
    isOffRoute,
    offRouteMeters,
    sosActive,
    activeAnnouncement,
    tripTitle,
  });

  useEffect(() => {
    stateRef.current = {
      pinnedStop,
      distToPinnedStop,
      arrivedCount,
      totalRiders,
      riders,
      currentSpeedKmh,
      fuelRangeKm,
      isOffRoute,
      offRouteMeters,
      sosActive,
      activeAnnouncement,
      tripTitle,
    };
  }, [pinnedStop, distToPinnedStop, arrivedCount, totalRiders, riders, currentSpeedKmh, fuelRangeKm, isOffRoute, offRouteMeters, sosActive, activeAnnouncement, tripTitle]);

  // Check if platform supports native video PiP (Desktop, Android Chrome, and Apple iOS WebKit)
  useEffect(() => {
    const hasVideoPip = typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && Boolean(document.pictureInPictureEnabled);
    const hasDocPip = typeof window !== 'undefined' && 'documentPictureInPicture' in window;
    const hasWebkitPip = typeof HTMLVideoElement !== 'undefined' &&
      typeof (HTMLVideoElement.prototype as unknown as WebkitHTMLVideoElement).webkitSetPresentationMode === 'function';
    setNativePipAvailable(hasVideoPip || hasDocPip || hasWebkitPip);
  }, []);

  // Pre-attach canvas stream to video element so playback pipeline is active before user clicks
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    if (!streamRef.current) {
      const stream = getCanvasStreamWithAudio(canvas);
      if (stream) {
        streamRef.current = stream;
        video.srcObject = stream;
        video.play().catch(() => {/* ignore autoplay rejection */});
      }
    }
  }, []);

  // 60 FPS Canvas Drawing Engine — Vertical Cockpit HUD (240 x 380 logical @ 3x HiDPI)
  const drawFrame = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, time: number) => {
    const {
      pinnedStop: stop,
      distToPinnedStop: stopDist,
      arrivedCount: arrived,
      totalRiders: total,
      riders: riderList,
      currentSpeedKmh: speed,
      fuelRangeKm: fuelKm,
      isOffRoute: offRoute,
      offRouteMeters: offMeters,
      sosActive: sos,
      activeAnnouncement: announcement,
    } = stateRef.current;

    const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

    // Background: Deep Obsidian
    ctx.fillStyle = '#090B0E';
    ctx.fillRect(0, 0, width, height);

    // Outer Border: Flashing red on SOS/Off-route, otherwise subtle gold
    ctx.lineWidth = 2;
    ctx.strokeStyle = sos ? '#EF4444' : offRoute ? '#F59E0B' : 'rgba(240, 194, 58, 0.45)';
    ctx.strokeRect(1, 1, width - 2, height - 2);

    const pulse = (Math.sin(time / 180) + 1) / 2;
    const liveRiders = riderList.filter((r) => r.isLive !== false).length;

    // =========================================================================
    // 1. TOP STATUS BAR: Live Indicator & Clock (y: 0 - 24px)
    // =========================================================================
    ctx.fillStyle = '#10B981';
    ctx.beginPath();
    ctx.arc(12, 13, 2.8 + pulse * 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.font = `800 9.5px ${FONT}`;
    ctx.fillStyle = '#10B981';
    ctx.fillText(`${liveRiders}/${Math.max(total, 1)} LIVE`, 20, 16.5);

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    ctx.textAlign = 'right';
    ctx.font = `600 9.5px ${FONT}`;
    ctx.fillStyle = '#9CA3AF';
    ctx.fillText(timeStr, width - 8, 16.5);

    ctx.lineWidth = 1;
    ctx.strokeStyle = '#181E27';
    ctx.beginPath();
    ctx.moveTo(8, 24);
    ctx.lineTo(width - 8, 24);
    ctx.stroke();

    // =========================================================================
    // 2. HERO SPEEDOMETER + FUEL RANGE + GROUP AVG (y: 25 - 70px)
    // =========================================================================
    const roundedSpeed = Math.round(speed || 0);
    ctx.textAlign = 'left';
    ctx.font = `900 28px ${FONT}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`${roundedSpeed}`, 10, 55);

    ctx.font = `800 8.5px ${FONT}`;
    ctx.fillStyle = '#F0C23A';
    ctx.fillText('KM/H', 11, 66);

    // Fuel Range Pill (Top-Right of Hero row)
    const fuelColor = fuelKm == null ? '#9CA3AF' : fuelKm <= 15 ? '#EF4444' : fuelKm <= 35 ? '#F59E0B' : '#10B981';
    const fuelBg = fuelKm == null ? '#12161E' : fuelKm <= 15 ? 'rgba(239, 68, 68, 0.18)' : fuelKm <= 35 ? 'rgba(245, 158, 11, 0.16)' : 'rgba(16, 185, 129, 0.15)';
    ctx.fillStyle = fuelBg;
    ctx.strokeStyle = fuelColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    drawRoundRect(ctx, 90, 29, 98, 20, 10);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = `800 9.5px ${FONT}`;
    ctx.fillStyle = fuelColor;
    ctx.fillText(fuelKm != null ? `⛽ ${Math.round(fuelKm)} km` : '⛽ Fuel unset', 139, 42.5);

    // Group Average Speed (Below Fuel Pill)
    const activeSpeeds = riderList.map((r) => r.speedKmh ?? 0).filter((s) => s > 2);
    const avgSpeed = activeSpeeds.length > 0
      ? Math.round(activeSpeeds.reduce((a, b) => a + b, 0) / activeSpeeds.length)
      : roundedSpeed;
    const speedDelta = roundedSpeed - avgSpeed;
    const deltaLabel = activeSpeeds.length > 1 && Math.abs(speedDelta) >= 5
      ? ` (${speedDelta > 0 ? '+' : ''}${speedDelta})`
      : '';

    ctx.textAlign = 'right';
    ctx.font = `700 9px ${FONT}`;
    ctx.fillStyle = '#9CA3AF';
    ctx.fillText(`AVG ${avgSpeed} km/h${deltaLabel}`, width - 10, 64);

    // =========================================================================
    // 3. PRIORITY ALERT / CONVOY PACING BANNER (y: 72 - 96px)
    // =========================================================================
    const ridersAhead = riderList
      .filter((r) => !r.isMe && (r.relativePosition === 'ahead' || ((r.relativeDistanceMeters ?? 0) > 0 && r.relativePosition !== 'behind')))
      .sort((a, b) => (a.relativeDistanceMeters ?? 0) - (b.relativeDistanceMeters ?? 0));

    const ridersBehind = riderList
      .filter((r) => !r.isMe && (r.relativePosition === 'behind' || ((r.relativeDistanceMeters ?? 0) < 0)))
      .sort((a, b) => (a.relativeDistanceMeters ?? 0) - (b.relativeDistanceMeters ?? 0));

    const quickRider = riderList.find((r) => !r.isMe && r.quickStatus && r.quickStatus.trim().length > 0);
    const maxBehindDist = ridersBehind.reduce((m, r) => Math.max(m, r.relativeDistanceMeters ?? 0), 0);
    const maxAheadDist = ridersAhead.reduce((m, r) => Math.max(m, r.relativeDistanceMeters ?? 0), 0);

    let bannerBg = 'rgba(16, 185, 129, 0.12)';
    let bannerBorder = 'rgba(16, 185, 129, 0.4)';
    let bannerColor = '#10B981';
    let bannerText = '✓ Convoy tight · In sync';

    if (sos) {
      const sosPulse = (Math.sin(time / 120) + 1) / 2;
      bannerBg = `rgba(239, 68, 68, ${0.22 + sosPulse * 0.28})`;
      bannerBorder = '#EF4444';
      bannerColor = '#FFFFFF';
      bannerText = '🚨 SOS: RIDER NEEDS HELP!';
    } else if (offRoute) {
      bannerBg = 'rgba(239, 68, 68, 0.22)';
      bannerBorder = '#EF4444';
      bannerColor = '#FCA5A5';
      bannerText = offMeters ? `↪️ OFF ROUTE · ${Math.round(offMeters)}m` : '↪️ OFF ROUTE · Check map';
    } else if (announcement) {
      bannerBg = 'rgba(240, 194, 58, 0.18)';
      bannerBorder = '#F0C23A';
      bannerColor = '#F0C23A';
      bannerText = `📢 ${announcement.message.slice(0, 22)}`;
    } else if (quickRider && quickRider.quickStatus) {
      bannerBg = 'rgba(245, 158, 11, 0.18)';
      bannerBorder = '#F59E0B';
      bannerColor = '#FCD34D';
      const firstName = quickRider.userName.split(' ')[0].slice(0, 7);
      bannerText = `💬 ${firstName}: ${quickRider.quickStatus.slice(0, 14)}`;
    } else if (maxBehindDist > 1200) {
      bannerBg = 'rgba(245, 158, 11, 0.16)';
      bannerBorder = '#F59E0B';
      bannerColor = '#FBBF24';
      bannerText = `⚠️ Tail +${formatDist(maxBehindDist)} · Ease`;
    } else if (maxAheadDist > 1200) {
      bannerBg = 'rgba(59, 130, 246, 0.16)';
      bannerBorder = '#3B82F6';
      bannerColor = '#93C5FD';
      bannerText = `⚡ Lead +${formatDist(maxAheadDist)} ahead`;
    }

    ctx.fillStyle = bannerBg;
    ctx.strokeStyle = bannerBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    drawRoundRect(ctx, 8, 72, width - 16, 23, 6);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = `800 9.5px ${FONT}`;
    ctx.fillStyle = bannerColor;
    ctx.fillText(bannerText, width / 2, 87);

    // =========================================================================
    // 4. NEXT PINNED STOP + ETA CARD (y: 99 - 131px)
    // =========================================================================
    ctx.fillStyle = '#12161E';
    ctx.strokeStyle = '#1D2431';
    ctx.lineWidth = 1;
    ctx.beginPath();
    drawRoundRect(ctx, 8, 99, width - 16, 32, 6);
    ctx.fill();
    ctx.stroke();

    if (stop) {
      const stopIcon = stop.type === 'fuel' ? '⛽' : stop.type === 'food' ? '🍲' : '📌';
      const stopShort = stop.name.length > 15 ? `${stop.name.slice(0, 14)}…` : stop.name;

      ctx.textAlign = 'left';
      ctx.font = `800 9.5px ${FONT}`;
      ctx.fillStyle = '#F0C23A';
      ctx.fillText(`${stopIcon} ${stopShort}`, 14, 112.5);

      ctx.textAlign = 'right';
      ctx.font = `800 9.5px ${FONT}`;
      ctx.fillStyle = '#E5E7EB';
      ctx.fillText(`${arrived}/${Math.max(total, 1)}`, width - 14, 112.5);

      const paceKmh = Math.max(roundedSpeed, avgSpeed, 35);
      const etaMins = stopDist != null ? Math.max(1, Math.round((stopDist / paceKmh) * 60)) : null;
      const distLabel = stopDist != null ? `${stopDist.toFixed(1)} km` : 'Dist --';
      const etaLabel = etaMins != null ? ` · ~${etaMins}m ETA` : '';

      ctx.textAlign = 'left';
      ctx.font = `600 9px ${FONT}`;
      ctx.fillStyle = '#9CA3AF';
      ctx.fillText(`${distLabel}${etaLabel}`, 14, 125);
    } else {
      ctx.textAlign = 'left';
      ctx.font = `700 9.5px ${FONT}`;
      ctx.fillStyle = '#9CA3AF';
      ctx.fillText('📌 No stop pinned', 14, 113);
      ctx.font = `500 8.5px ${FONT}`;
      ctx.fillText('Free ride mode active', 14, 125);
    }

    // Helper to render a slim vertical rider section (IN FRONT or BEHIND)
    const drawRiderSection = (
      title: string,
      titleColor: string,
      list: PipRiderData[],
      yStart: number,
      arrow: '▲' | '▼',
      emptyPrimary: string,
      emptyPrimaryColor: string,
      emptySub: string,
      isBehindSection: boolean
    ) => {
      const cardH = 68;
      ctx.fillStyle = '#12161E';
      ctx.strokeStyle = '#1D2431';
      ctx.lineWidth = 1;
      ctx.beginPath();
      drawRoundRect(ctx, 8, yStart, width - 16, cardH, 6);
      ctx.fill();
      ctx.stroke();

      // Left colored accent stripe for instant 0.3s glance differentiation
      ctx.fillStyle = titleColor;
      ctx.beginPath();
      drawRoundRect(ctx, 8, yStart + 5, 2.5, cardH - 10, 1.2);
      ctx.fill();

      // Header row
      ctx.textAlign = 'left';
      ctx.font = `900 9px ${FONT}`;
      ctx.fillStyle = titleColor;
      ctx.fillText(`${arrow} ${title} (${list.length})`, 16, yStart + 13.5);

      if (list.length > 2) {
        ctx.textAlign = 'right';
        ctx.font = `700 8.5px ${FONT}`;
        ctx.fillStyle = '#9CA3AF';
        ctx.fillText(`+${list.length - 2} more`, width - 13, yStart + 13.5);
      }

      if (list.length === 0) {
        ctx.textAlign = 'left';
        ctx.font = `700 10px ${FONT}`;
        ctx.fillStyle = emptyPrimaryColor;
        ctx.fillText(emptyPrimary, 16, yStart + 36);
        ctx.font = `500 8.5px ${FONT}`;
        ctx.fillStyle = '#9CA3AF';
        ctx.fillText(emptySub, 16, yStart + 50);
        return;
      }

      list.slice(0, 2).forEach((r, idx) => {
        const rowTop = yStart + 19 + idx * 23;
        const rowH = 21;
        const isLag = isBehindSection && (r.relativeDistanceMeters ?? 0) > 1200;
        const accentColor = r.isStale
          ? '#6B7280'
          : isBehindSection
            ? (isLag ? '#EF4444' : '#F59E0B')
            : '#10B981';

        // Subtle row card container
        ctx.fillStyle = '#171D28';
        ctx.beginPath();
        drawRoundRect(ctx, 14, rowTop, width - 26, rowH, 4.5);
        ctx.fill();

        // Avatar initial circle
        const cx = 23;
        const cy = rowTop + rowH / 2;
        ctx.fillStyle = r.isCaptain ? '#F0C23A' : accentColor;
        ctx.beginPath();
        ctx.arc(cx, cy, 6.5, 0, Math.PI * 2);
        ctx.fill();

        const initial = (r.userName || '?').trim().charAt(0).toUpperCase();
        ctx.textAlign = 'center';
        ctx.font = `900 8px ${FONT}`;
        ctx.fillStyle = '#090B0E';
        ctx.fillText(initial, cx, cy + 2.8);

        // Rider name + status prefix
        const prefix = isLag ? '⚠️' : r.isCaptain ? '👑' : '';
        const maxLen = prefix ? 7 : 9;
        const cleanName = r.userName.length > maxLen ? `${r.userName.slice(0, maxLen - 1)}…` : r.userName;
        ctx.textAlign = 'left';
        ctx.font = `700 9.5px ${FONT}`;
        ctx.fillStyle = r.isStale ? '#9CA3AF' : '#FFFFFF';
        ctx.fillText(`${prefix}${cleanName}`, 33, rowTop + 13.5);

        // Speed or Stale age tag (aligned cleanly left of the distance pill)
        if (r.isStale) {
          ctx.textAlign = 'right';
          ctx.font = `600 8px ${FONT}`;
          ctx.fillStyle = '#9CA3AF';
          ctx.fillText(r.staleAgeLabel ? `🕒${r.staleAgeLabel}` : '🕒stale', width - 58, rowTop + 13.5);
        } else if (r.speedKmh != null && r.speedKmh > 0) {
          ctx.textAlign = 'right';
          ctx.font = `600 8px ${FONT}`;
          ctx.fillStyle = '#9CA3AF';
          ctx.fillText(`${Math.round(r.speedKmh)}k`, width - 58, rowTop + 13.5);
        }

        // Distance badge pill on the right
        const pillW = 42;
        const pillH = 15;
        const pillX = width - 14 - pillW;
        const pillY = rowTop + 3;
        ctx.fillStyle = r.isStale
          ? 'rgba(107, 114, 128, 0.2)'
          : isBehindSection
            ? (isLag ? 'rgba(239, 68, 68, 0.22)' : 'rgba(245, 158, 11, 0.16)')
            : 'rgba(16, 185, 129, 0.16)';
        ctx.beginPath();
        drawRoundRect(ctx, pillX, pillY, pillW, pillH, 3.5);
        ctx.fill();

        ctx.textAlign = 'center';
        ctx.font = `900 9px ${FONT}`;
        ctx.fillStyle = accentColor;
        ctx.fillText(`${formatDist(r.relativeDistanceMeters)} ${arrow}`, pillX + pillW / 2, rowTop + 13.5);
      });
    };

    // =========================================================================
    // 5. VERTICAL RIDER STACK: IN FRONT (y: 135 - 203px)
    // =========================================================================
    drawRiderSection(
      'IN FRONT',
      '#10B981',
      ridersAhead,
      135,
      '▲',
      '👑 You lead convoy',
      '#F0C23A',
      'No riders ahead',
      false
    );

    // =========================================================================
    // 6. VERTICAL RIDER STACK: BEHIND (y: 207 - 275px)
    // =========================================================================
    drawRiderSection(
      'BEHIND',
      '#F59E0B',
      ridersBehind,
      207,
      '▼',
      '🏁 You are at tail',
      '#E5E7EB',
      'Sweep position',
      true
    );

    // =========================================================================
    // 7. MICRO CONVOY RAIL TICKER (y: 280 - 306px)
    // =========================================================================
    const railY = 295;
    const railLeft = 14;
    const railRight = width - 14;
    const railWidth = railRight - railLeft;

    ctx.lineWidth = 3;
    ctx.strokeStyle = '#181E27';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(railLeft, railY);
    ctx.lineTo(railRight, railY);
    ctx.stroke();

    riderList.forEach((r, idx) => {
      const pct = Math.min(96, Math.max(4, r.progressPercent ?? (20 + idx * 18)));
      const pipX = railLeft + (railWidth * pct) / 100;

      if (r.isMe) {
        ctx.fillStyle = 'rgba(240, 194, 58, 0.25)';
        ctx.beginPath();
        ctx.arc(pipX, railY, 7 + pulse * 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#F0C23A';
        ctx.beginPath();
        ctx.arc(pipX, railY, 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.textAlign = 'center';
        ctx.font = `900 8.5px ${FONT}`;
        ctx.fillStyle = '#F0C23A';
        ctx.fillText('YOU', pipX, railY - 8);
      } else {
        ctx.fillStyle = r.isStale ? '#6B7280' : r.isCaptain ? '#F59E0B' : r.relativePosition === 'ahead' ? '#10B981' : '#3B82F6';
        ctx.beginPath();
        ctx.arc(pipX, railY, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }, []);

  // Animation Loop: 60 FPS at 3x HiDPI (1260 x 465)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    const render = (time: number) => {
      if (!isRunning) return;
      ctx.save();
      ctx.scale(HUD_SCALE, HUD_SCALE);
      drawFrame(ctx, HUD_WIDTH, HUD_HEIGHT, time);
      ctx.restore();

      const docCanvas = docPipCanvasRef.current;
      if (docCanvas) {
        const docCtx = docCanvas.getContext('2d');
        if (docCtx) {
          docCtx.save();
          docCtx.scale(HUD_SCALE, HUD_SCALE);
          drawFrame(docCtx, HUD_WIDTH, HUD_HEIGHT, time);
          docCtx.restore();
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [drawFrame]);

  // Close PiP HUD (Document PiP, Video OS PiP, and in-app floating ribbon)
  const closePip = useCallback(async () => {
    if (docPipWindowRef.current) {
      try {
        docPipWindowRef.current.close();
      } catch {
        // ignore
      }
      docPipWindowRef.current = null;
      docPipCanvasRef.current = null;
    }
    const video = videoRef.current;
    if (typeof document !== 'undefined' && document.pictureInPictureElement) {
      try {
        await document.exitPictureInPicture();
      } catch {
        // ignore
      }
    }
    if (video) {
      const webkitVideo = video as unknown as WebkitHTMLVideoElement;
      if (typeof webkitVideo.webkitSetPresentationMode === 'function' && webkitVideo.webkitPresentationMode === 'picture-in-picture') {
        try {
          webkitVideo.webkitSetPresentationMode('inline');
        } catch {
          // ignore
        }
      }
    }
    setIsFloatingInApp(false);
    setIsPipActive(false);
    onPipStateChange?.(false);
  }, [onPipStateChange]);

  // Open PiP HUD (Document PiP -> Video PiP / WebKit -> In-App ribbon fallback)
  const openPip = useCallback(async () => {
    const prefs = getPipPreferences();
    const forceInApp = prefs.preferredMode === 'in_app';
    const canvas = canvasRef.current;
    const video = videoRef.current;

    // 0. Try Document Picture-in-Picture first (Desktop Chrome/Edge: crisp vertical HTML window, ZERO video controls!)
    const docPip = typeof window !== 'undefined' ? (window as WindowWithDocPiP).documentPictureInPicture : undefined;
    if (!forceInApp && docPip && typeof docPip.requestWindow === 'function') {
      try {
        const pipWin = await docPip.requestWindow({ width: HUD_WIDTH, height: HUD_HEIGHT + 36 });
        docPipWindowRef.current = pipWin;

        pipWin.document.title = 'Payanam Live HUD';
        pipWin.document.body.style.margin = '0';
        pipWin.document.body.style.padding = '0';
        pipWin.document.body.style.backgroundColor = '#090B0E';
        pipWin.document.body.style.overflow = 'hidden';
        pipWin.document.body.style.display = 'flex';
        pipWin.document.body.style.flexDirection = 'column';
        pipWin.document.body.style.height = '100vh';
        pipWin.document.body.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

        const canvasWrap = pipWin.document.createElement('div');
        canvasWrap.style.width = '100%';
        canvasWrap.style.flex = '1';
        canvasWrap.style.minHeight = '0';
        canvasWrap.style.overflow = 'hidden';

        const docCanvas = pipWin.document.createElement('canvas');
        docCanvas.width = HUD_WIDTH * HUD_SCALE;
        docCanvas.height = HUD_HEIGHT * HUD_SCALE;
        docCanvas.style.width = '100%';
        docCanvas.style.height = 'auto';
        docCanvas.style.display = 'block';
        canvasWrap.appendChild(docCanvas);
        pipWin.document.body.appendChild(canvasWrap);
        docPipCanvasRef.current = docCanvas;

        // Interactive 1-tap glove-friendly quick-action bar at the bottom of Document PiP
        const actionBar = pipWin.document.createElement('div');
        actionBar.style.display = 'flex';
        actionBar.style.gap = '3px';
        actionBar.style.padding = '4px 6px';
        actionBar.style.backgroundColor = '#0D1016';
        actionBar.style.borderTop = '1px solid #1E2430';
        actionBar.style.flexShrink = '0';

        let isDocMini = false;
        const actions: { label: string; onClick: (btn: HTMLButtonElement) => void; accent?: boolean }[] = [
          { label: '✋', onClick: () => onQuickStatus?.('Wait up!') },
          { label: '⛽', onClick: () => onQuickStatus?.('Need fuel') },
          { label: '👍', onClick: () => onQuickStatus?.('All good') },
          {
            label: '⤡ Mini',
            onClick: (btn) => {
              isDocMini = !isDocMini;
              btn.textContent = isDocMini ? '⤢ Full' : '⤡ Mini';
              try {
                pipWin.resizeTo(HUD_WIDTH, isDocMini ? 140 : HUD_HEIGHT + 36);
              } catch {
                // ignore resize restrictions
              }
            },
          },
          {
            label: '🗺️',
            accent: true,
            onClick: () => {
              onFocusApp?.();
              try {
                pipWin.close();
              } catch {
                // ignore
              }
            },
          },
        ];

        actions.forEach((act) => {
          const btn = pipWin.document.createElement('button');
          btn.type = 'button';
          btn.textContent = act.label;
          btn.style.flex = act.label.includes('Mini') ? '1.6' : '1';
          btn.style.padding = '4px 2px';
          btn.style.borderRadius = '7px';
          btn.style.border = act.accent ? '1px solid #F0C23A' : '1px solid rgba(255,255,255,0.14)';
          btn.style.backgroundColor = act.accent ? 'rgba(240, 194, 58, 0.16)' : 'rgba(255,255,255,0.06)';
          btn.style.color = act.accent ? '#F0C23A' : '#FFFFFF';
          btn.style.fontSize = '10px';
          btn.style.fontWeight = '700';
          btn.style.cursor = 'pointer';
          btn.addEventListener('click', () => act.onClick(btn));
          actionBar.appendChild(btn);
        });

        pipWin.document.body.appendChild(actionBar);

        pipWin.addEventListener('pagehide', () => {
          docPipWindowRef.current = null;
          docPipCanvasRef.current = null;
          setIsPipActive(false);
          onPipStateChange?.(false);
        });

        setIsPipActive(true);
        setIsFloatingInApp(false);
        onPipStateChange?.(true);
        return;
      } catch (err) {
        console.warn('[PiP HUD] Document PiP failed, falling back to Video PiP:', err);
      }
    }

    // 1. Try Native Video OS PiP if available (Android Chrome, Apple iOS WebKit, or fallback)
    if (!forceInApp && nativePipAvailable && canvas && video) {
      try {
        if (!streamRef.current) {
          const stream = getCanvasStreamWithAudio(canvas);
          if (stream) {
            streamRef.current = stream;
            video.srcObject = stream;
          }
        }

        try {
          await video.play();
        } catch {
          // ignore
        }

        const webkitVideo = video as unknown as WebkitHTMLVideoElement;

        // Path A: Apple iOS WebKit presentation mode (Safari, Brave on iOS)
        if (typeof webkitVideo.webkitSetPresentationMode === 'function') {
          try {
            webkitVideo.webkitSetPresentationMode('picture-in-picture');
            setTimeout(() => {
              if (webkitVideo.webkitPresentationMode === 'picture-in-picture') {
                setIsPipActive(true);
                setIsFloatingInApp(false);
                onPipStateChange?.(true);
              } else {
                setIsFloatingInApp(true);
                setIsPipActive(true);
                onPipStateChange?.(true);
              }
            }, 300);
            return;
          } catch (err) {
            console.warn('[PiP HUD] Apple WebKit presentation mode failed:', err);
          }
        }

        // Path B: Standard W3C requestPictureInPicture (Chrome, Edge, Android)
        if (typeof video.requestPictureInPicture === 'function') {
          await video.requestPictureInPicture();
          setIsPipActive(true);
          setIsFloatingInApp(false);
          onPipStateChange?.(true);
          return;
        }
      } catch (err) {
        console.warn('[PiP HUD] Native OS PiP failed, opening 60 FPS Floating In-App HUD:', err);
      }
    }

    // 2. Mobile & iOS Guaranteed Fallback: 60 FPS Floating In-App Cockpit Ribbon
    setIsFloatingInApp(true);
    setIsPipActive(true);
    onPipStateChange?.(true);
  }, [nativePipAvailable, onPipStateChange, onQuickStatus, onFocusApp]);

  // Toggle handler for button taps
  const togglePip = useCallback(() => {
    if (isPipActive || isFloatingInApp) {
      closePip();
    } else {
      openPip();
    }
  }, [isPipActive, isFloatingInApp, closePip, openPip]);

  // Handle Dock Position toggle & persist to preferences
  const handleDockToggle = useCallback(() => {
    setHudDockPosition((pos) => {
      const next = pos === 'bottom' ? 'top' : 'bottom';
      savePipPreferences({ dockPosition: next });
      return next;
    });
  }, []);

  // Auto-launch HUD exactly once if enabled in rider preferences
  useEffect(() => {
    if (autoOpenedRef.current) return;
    const prefs = getPipPreferences();
    if (prefs.autoOpenOnRide) {
      autoOpenedRef.current = true;
      openPip();
    }
  }, [openPip]);

  // Handle Native OS PiP event listeners (Standard W3C + Apple WebKit for iOS)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onEnter = () => {
      setIsPipActive(true);
      setIsFloatingInApp(false);
      onPipStateChange?.(true);
    };

    const onLeave = () => {
      setIsPipActive(false);
      onPipStateChange?.(false);
    };

    const handleWebkitPresentation = () => {
      const webkitVideo = video as unknown as WebkitHTMLVideoElement;
      const mode = webkitVideo.webkitPresentationMode;
      if (mode === 'picture-in-picture') {
        setIsPipActive(true);
        setIsFloatingInApp(false);
        onPipStateChange?.(true);
      } else if (mode === 'inline') {
        setIsPipActive(false);
        onPipStateChange?.(false);
      }
    };

    video.addEventListener('enterpictureinpicture', onEnter);
    video.addEventListener('leavepictureinpicture', onLeave);
    video.addEventListener('webkitpresentationmodechanged', handleWebkitPresentation);

    return () => {
      video.removeEventListener('enterpictureinpicture', onEnter);
      video.removeEventListener('leavepictureinpicture', onLeave);
      video.removeEventListener('webkitpresentationmodechanged', handleWebkitPresentation);
    };
  }, [onPipStateChange]);

  return (
    <>
      {createPortal(<>
      {/* 60 FPS Vertical Floating In-App HUD Container (Single Persistent DOM Node) */}
      <div
        style={{
          position: 'fixed',
          ...(isFloatingInApp
            ? {
                ...(hudDockPosition === 'bottom'
                  ? { bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }
                  : { top: 'calc(76px + env(safe-area-inset-top, 0px))' }),
                right: 10,
                width: 'min(62vw, 212px)',
                zIndex: 9999,
                opacity: 1,
                pointerEvents: 'auto',
                visibility: 'visible',
              }
            : {
                top: -9999,
                left: -9999,
                width: 212,
                opacity: 0,
                pointerEvents: 'none',
                visibility: 'hidden',
              }),
          backgroundColor: 'rgba(9, 11, 14, 0.96)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1.5px solid rgba(240, 194, 58, 0.8)',
          borderRadius: 16,
          padding: 7,
          boxSizing: 'border-box',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.8), 0 0 15px rgba(240, 194, 58, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          touchAction: 'manipulation',
          transition: 'opacity 0.15s ease',
        }}
      >
        {/* Header strip: Title, Compact toggle, Dock position switch, Close */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '2px 2px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 12 }}>📺</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                color: '#F0C23A',
              }}
            >
              Live HUD
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              onClick={() => setIsCompact((v) => !v)}
              style={{
                background: isCompact ? 'rgba(240, 194, 58, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                border: isCompact ? '1px solid #F0C23A' : '1px solid rgba(255, 255, 255, 0.15)',
                color: isCompact ? '#F0C23A' : '#FFFFFF',
                borderRadius: 8,
                padding: '3px 6px',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                touchAction: 'manipulation',
              }}
              title={isCompact ? 'Expand full HUD' : 'Compact view'}
            >
              {isCompact ? '⤢ Full' : '⤡ Mini'}
            </button>

            <button
              type="button"
              onClick={handleDockToggle}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#FFFFFF',
                borderRadius: 8,
                padding: '3px 6px',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                touchAction: 'manipulation',
              }}
              title={hudDockPosition === 'bottom' ? 'Dock to top' : 'Dock to bottom'}
            >
              {hudDockPosition === 'bottom' ? '⬆' : '⬇'}
            </button>

            <button
              type="button"
              onClick={closePip}
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid #EF4444',
                color: '#EF4444',
                fontSize: 11,
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                touchAction: 'manipulation',
              }}
              title="Close Floating HUD"
              aria-label="Close Floating HUD"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Persistent 60 FPS Canvas in 3x HiDPI Vertical Ratio (cropped in Mini mode) */}
        <div
          style={{
            width: '100%',
            overflow: 'hidden',
            borderRadius: 10,
            maxHeight: isCompact ? 98 : 340,
            transition: 'max-height 0.18s ease',
          }}
        >
          <canvas
            ref={canvasRef}
            width={HUD_WIDTH * HUD_SCALE}
            height={HUD_HEIGHT * HUD_SCALE}
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              background: '#090B0E',
            }}
          />
        </div>

        {/* Interactive 1-Tap Glove-Friendly Quick Actions */}
        {onQuickStatus && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              onClick={() => onQuickStatus('Wait up!')}
              style={{
                flex: 1, padding: '5px 2px', borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)',
                color: '#FFFFFF', fontSize: 10, fontWeight: 700, cursor: 'pointer', touchAction: 'manipulation',
              }}
            >
              ✋ Wait
            </button>
            <button
              type="button"
              onClick={() => onQuickStatus('Need fuel')}
              style={{
                flex: 1, padding: '5px 2px', borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)',
                color: '#FFFFFF', fontSize: 10, fontWeight: 700, cursor: 'pointer', touchAction: 'manipulation',
              }}
            >
              ⛽ Fuel
            </button>
            <button
              type="button"
              onClick={() => onQuickStatus('All good')}
              style={{
                flex: 1, padding: '5px 2px', borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)',
                color: '#FFFFFF', fontSize: 10, fontWeight: 700, cursor: 'pointer', touchAction: 'manipulation',
              }}
            >
              👍 OK
            </button>
          </div>
        )}
      </div>

      {/* Video element feeding Native PiP window (must remain within viewport DOM bounds for Apple WebKit) */}
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        aria-hidden="true"
        style={{
          position: 'fixed',
          bottom: 0,
          right: 0,
          width: 4,
          height: 4,
          opacity: 0.001,
          pointerEvents: 'none',
          zIndex: -1,
        }}
      />

      </>, document.body)}

      {/* Custom or Default Trigger Button */}
      {renderTrigger ? (
        renderTrigger({ isPipActive, togglePip, isSupported })
      ) : (
        <button
          type="button"
          onClick={togglePip}
          aria-label={isPipActive ? 'Close floating view' : 'Open floating view'}
          title={isPipActive ? 'Close floating view' : 'Open floating view'}
          style={{
            width: 38, height: 38, borderRadius: 999, flexShrink: 0,
            backgroundColor: isPipActive ? 'var(--pz-warn-bg)' : 'rgba(27, 30, 35, 0.88)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: isPipActive ? '1.5px solid var(--pz-accent, #F0C23A)' : '1px solid rgba(255,255,255,0.25)',
            color: isPipActive ? 'var(--pz-accent, #F0C23A)' : '#FFFFFF',
            fontSize: 18, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)',
            touchAction: 'manipulation', pointerEvents: 'auto', transition: 'all 0.15s ease',
          }}
        >
          <Icon name="eye" />
        </button>
      )}
    </>
  );
};

