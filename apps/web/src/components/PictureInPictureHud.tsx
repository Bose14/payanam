import Icon from './Icon';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { PinnedStopData } from './PinStopModal';
import { getPipPreferences, savePipPreferences, isPlatformIos } from '../utils/pipPreferences';

interface WebkitHTMLVideoElement extends HTMLVideoElement {
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitSetPresentationMode?: (mode: string) => void;
  webkitPresentationMode?: string;
}

export interface PipRiderData {
  userId: string;
  userName: string;
  speedKmh?: number;
  isCaptain?: boolean;
  isMe?: boolean;
  isLive?: boolean;
  isStale?: boolean;
  staleAgeLabel?: string;
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
  sosActive?: boolean;
  activeAnnouncement?: { message: string; urgency?: string; icon?: string } | null;
  tripTitle?: string;
  renderTrigger?: (props: { isPipActive: boolean; togglePip: () => void; isSupported: boolean }) => React.ReactNode;
  onPipStateChange?: (active: boolean) => void;
}

function formatDist(meters?: number): string {
  if (meters == null || isNaN(meters)) return '--';
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}k`;
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
  sosActive = false,
  activeAnnouncement = null,
  tripTitle = 'Payanam Convoy',
  renderTrigger,
  onPipStateChange,
}) => {
  const [isPipActive, setIsPipActive] = useState(false);
  const [isFloatingInApp, setIsFloatingInApp] = useState(false);
  const [hudDockPosition, setHudDockPosition] = useState<'top' | 'bottom'>(
    () => getPipPreferences().dockPosition
  );
  const [nativePipAvailable, setNativePipAvailable] = useState(false);
  const isSupported = true; // Always supported via Native OS PiP or Floating In-App HUD!

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
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
      sosActive,
      activeAnnouncement,
      tripTitle,
    };
  }, [pinnedStop, distToPinnedStop, arrivedCount, totalRiders, riders, currentSpeedKmh, sosActive, activeAnnouncement, tripTitle]);

  // Check if platform supports native video PiP (Desktop, Android Chrome).
  // Note: Apple iOS WebKit strictly forbids canvas captureStream from popping out to OS level.
  useEffect(() => {
    const isIos = isPlatformIos();
    const hasVideoPip = !isIos && typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && Boolean(document.pictureInPictureEnabled);
    const hasDocPip = !isIos && typeof window !== 'undefined' && 'documentPictureInPicture' in window;
    setNativePipAvailable(hasVideoPip || hasDocPip);
  }, []);

  // 60 FPS Canvas Drawing Engine — Compact Non-Intrusive Ribbon for Mobile Navigation (420 x 155)
  const drawFrame = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, time: number) => {
    const {
      pinnedStop: stop,
      distToPinnedStop: stopDist,
      arrivedCount: arrived,
      totalRiders: total,
      riders: riderList,
      currentSpeedKmh: speed,
      sosActive: sos,
      activeAnnouncement: announcement,
    } = stateRef.current;

    // Background: Deep Obsidian
    ctx.fillStyle = '#090B0E';
    ctx.fillRect(0, 0, width, height);

    // Sleek Border: Flashing red on SOS, otherwise subtle gold border
    ctx.lineWidth = 2;
    ctx.strokeStyle = sos ? 'var(--pz-bad)' : 'var(--pz-warn-bg)';
    ctx.strokeRect(1, 1, width - 2, height - 2);

    // =========================================================================
    // 1. TOP HEADER BAR: Speedometer, Next Stop, Live status & Clock (0 - 36px)
    // =========================================================================
    const pulse = (Math.sin(time / 180) + 1) / 2;
    const liveRiders = riderList.filter((r) => r.isLive !== false).length;

    // Live Dot
    ctx.fillStyle = 'var(--pz-ok)';
    ctx.beginPath();
    ctx.arc(16, 20, 3.5 + pulse * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Speedometer (Hero display)
    const roundedSpeed = Math.round(speed || 0);
    ctx.textAlign = 'left';
    ctx.font = '900 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`${roundedSpeed}`, 28, 27);

    ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = 'var(--pz-accent)';
    ctx.fillText('KM/H', 62, 26);

    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = 'var(--pz-ok)';
    ctx.fillText(`● ${liveRiders}/${total} LIVE`, 104, 25);

    // Next Stop Compact Pill (Center-Right)
    if (stop) {
      const stopIcon = stop.type === 'fuel' ? '⛽' : stop.type === 'food' ? '🍲' : '📌';
      const distStr = stopDist != null ? `${stopDist.toFixed(1)}k` : '';
      const stopShort = stop.name.length > 14 ? `${stop.name.slice(0, 12)}…` : stop.name;

      ctx.textAlign = 'right';
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = 'var(--pz-accent)';
      ctx.fillText(`${stopIcon} ${stopShort} ${distStr} (${arrived}/${Math.max(total, 1)})`, width - 64, 25);
    }

    // Digital Clock (Right)
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    ctx.textAlign = 'right';
    ctx.font = '600 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = 'var(--pz-muted)';
    ctx.fillText(timeStr, width - 12, 25);

    // Divider
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#181E27';
    ctx.beginPath();
    ctx.moveTo(10, 36);
    ctx.lineTo(width - 10, 36);
    ctx.stroke();

    // =========================================================================
    // 2. DUAL SPLIT COLUMNS: Ahead (Left) vs Behind (Right) (40 - 115px)
    // =========================================================================
    if (sos) {
      // 🚨 Full Emergency Override Mode
      const sosPulse = (Math.sin(time / 120) + 1) / 2;
      ctx.fillStyle = `rgba(239, 68, 68, ${0.2 + sosPulse * 0.3})`;
      ctx.strokeStyle = 'var(--pz-bad)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      drawRoundRect(ctx, 10, 42, width - 20, 68, 8);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.font = '900 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = 'var(--pz-bad)';
      ctx.fillText('🚨 SOS: FELLOW RIDER NEEDS HELP!', width / 2, 70);

      ctx.font = 'bold 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('Emergency reported on road · Check group coordinates', width / 2, 92);
    } else if (announcement) {
      // 📢 Captain Announcement Override
      ctx.fillStyle = 'var(--pz-warn-bg)';
      ctx.strokeStyle = 'var(--pz-accent)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      drawRoundRect(ctx, 10, 42, width - 20, 68, 8);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = '900 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = 'var(--pz-accent)';
      ctx.fillText('📢 CAPTAIN CALL:', 20, 64);

      ctx.font = 'bold 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(announcement.message.slice(0, 44), 20, 88);
    } else {
      // Normal Dual Split Mode
      const colWidth = (width - 28) / 2; // ~196px each
      const leftColX = 10;
      const rightColX = leftColX + colWidth + 8;
      const cardHeight = 72;

      // Filter riders relative to me
      const ridersAhead = riderList
        .filter((r) => !r.isMe && (r.relativePosition === 'ahead' || ((r.relativeDistanceMeters ?? 0) > 0 && r.relativePosition !== 'behind')))
        .sort((a, b) => (a.relativeDistanceMeters ?? 0) - (b.relativeDistanceMeters ?? 0));

      const ridersBehind = riderList
        .filter((r) => !r.isMe && (r.relativePosition === 'behind' || ((r.relativeDistanceMeters ?? 0) < 0)))
        .sort((a, b) => (a.relativeDistanceMeters ?? 0) - (b.relativeDistanceMeters ?? 0));

      // --- LEFT COLUMN: AHEAD (▲) ---
      ctx.fillStyle = '#12161E';
      ctx.strokeStyle = '#1D2431';
      ctx.lineWidth = 1;
      ctx.beginPath();
      drawRoundRect(ctx, leftColX, 40, colWidth, cardHeight, 6);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = '900 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = 'var(--pz-ok)';
      ctx.fillText(`▲ IN FRONT (${ridersAhead.length})`, leftColX + 8, 54);

      if (ridersAhead.length === 0) {
        ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = 'var(--pz-accent)';
        ctx.fillText('👑 You lead convoy', leftColX + 8, 76);
        ctx.font = '500 9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = 'var(--pz-muted)';
        ctx.fillText('No riders ahead', leftColX + 8, 94);
      } else {
        // Up to 2 riders stacked
        const r1 = ridersAhead[0];
        const r2 = ridersAhead[1];

        // Rider 1
        ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = '#FFFFFF';
        const tag1 = r1.isCaptain ? '👑 ' : '';
        const name1 = r1.userName.length > 8 ? `${r1.userName.slice(0, 7)}…` : r1.userName;
        ctx.fillText(`${tag1}${name1}`, leftColX + 8, 73);

        ctx.textAlign = 'right';
        ctx.font = '900 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = 'var(--pz-ok)';
        ctx.fillText(`${formatDist(r1.relativeDistanceMeters)} ▲`, leftColX + colWidth - 8, 73);

        // Rider 2 (or speed subtitle if only 1 rider)
        if (r2) {
          ctx.textAlign = 'left';
          ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillStyle = '#FFFFFF';
          const tag2 = r2.isCaptain ? '👑 ' : '';
          const name2 = r2.userName.length > 8 ? `${r2.userName.slice(0, 7)}…` : r2.userName;
          ctx.fillText(`${tag2}${name2}`, leftColX + 8, 97);

          ctx.textAlign = 'right';
          ctx.font = '900 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillStyle = 'var(--pz-ok)';
          ctx.fillText(`${formatDist(r2.relativeDistanceMeters)} ▲`, leftColX + colWidth - 8, 97);
        } else if (r1.speedKmh != null && r1.speedKmh > 0) {
          ctx.textAlign = 'left';
          ctx.font = '600 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillStyle = 'var(--pz-muted)';
          ctx.fillText(`Riding at ${Math.round(r1.speedKmh)} km/h`, leftColX + 8, 94);
        }
      }

      // --- RIGHT COLUMN: BEHIND (▼) ---
      ctx.fillStyle = '#12161E';
      ctx.strokeStyle = '#1D2431';
      ctx.lineWidth = 1;
      ctx.beginPath();
      drawRoundRect(ctx, rightColX, 40, colWidth, cardHeight, 6);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = '900 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#F59E0B';
      ctx.fillText(`▼ BEHIND (${ridersBehind.length})`, rightColX + 8, 54);

      if (ridersBehind.length === 0) {
        ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = 'var(--pz-muted)';
        ctx.fillText('🏁 You are at tail', rightColX + 8, 76);
        ctx.font = '500 9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = 'var(--pz-muted)';
        ctx.fillText('Sweep position', rightColX + 8, 94);
      } else {
        const r1 = ridersBehind[0];
        const r2 = ridersBehind[1];

        // Rider 1
        const isLag1 = (r1.relativeDistanceMeters ?? 0) > 1200;
        ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = '#FFFFFF';
        const tag1 = isLag1 ? '⚠️ ' : r1.isCaptain ? '👑 ' : '';
        const name1 = r1.userName.length > 8 ? `${r1.userName.slice(0, 7)}…` : r1.userName;
        ctx.fillText(`${tag1}${name1}`, rightColX + 8, 73);

        ctx.textAlign = 'right';
        ctx.font = '900 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = isLag1 ? 'var(--pz-bad)' : '#F59E0B';
        ctx.fillText(`${formatDist(r1.relativeDistanceMeters)} ▼`, rightColX + colWidth - 8, 73);

        // Rider 2
        if (r2) {
          const isLag2 = (r2.relativeDistanceMeters ?? 0) > 1200;
          ctx.textAlign = 'left';
          ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillStyle = '#FFFFFF';
          const tag2 = isLag2 ? '⚠️ ' : r2.isCaptain ? '👑 ' : '';
          const name2 = r2.userName.length > 8 ? `${r2.userName.slice(0, 7)}…` : r2.userName;
          ctx.fillText(`${tag2}${name2}`, rightColX + 8, 97);

          ctx.textAlign = 'right';
          ctx.font = '900 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillStyle = isLag2 ? 'var(--pz-bad)' : '#F59E0B';
          ctx.fillText(`${formatDist(r2.relativeDistanceMeters)} ▼`, rightColX + colWidth - 8, 97);
        } else if (r1.speedKmh != null && r1.speedKmh > 0) {
          ctx.textAlign = 'left';
          ctx.font = '600 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillStyle = 'var(--pz-muted)';
          ctx.fillText(`Riding at ${Math.round(r1.speedKmh)} km/h`, rightColX + 8, 94);
        }
      }
    }

    // =========================================================================
    // 3. MICRO CONVOY RAIL TICKER (122 - 148px)
    // =========================================================================
    const railY = 135;
    const railLeft = 20;
    const railRight = width - 20;
    const railWidth = railRight - railLeft;

    // Track rail line
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#181E27';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(railLeft, railY);
    ctx.lineTo(railRight, railY);
    ctx.stroke();

    // Rider Pips along rail with YOU highlighted
    riderList.forEach((r, idx) => {
      const pct = Math.min(96, Math.max(4, r.progressPercent ?? (20 + idx * 18)));
      const pipX = railLeft + (railWidth * pct) / 100;

      if (r.isMe) {
        // Pulsing glow for YOU
        ctx.fillStyle = 'var(--pz-warn-bg)';
        ctx.beginPath();
        ctx.arc(pipX, railY, 7 + pulse * 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'var(--pz-accent)';
        ctx.beginPath();
        ctx.arc(pipX, railY, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // "YOU" Label
        ctx.textAlign = 'center';
        ctx.font = '900 8.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = 'var(--pz-accent)';
        ctx.fillText('YOU', pipX, railY - 8);
      } else {
        ctx.fillStyle = r.isCaptain ? '#F59E0B' : r.relativePosition === 'ahead' ? 'var(--pz-ok)' : '#3B82F6';
        ctx.beginPath();
        ctx.arc(pipX, railY, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }, []);

  // Animation Loop: 60 FPS
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    const render = (time: number) => {
      if (!isRunning) return;
      drawFrame(ctx, canvas.width, canvas.height, time);
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [drawFrame]);

  // Close PiP HUD (both native OS PiP and in-app floating ribbon)
  const closePip = useCallback(async () => {
    if (typeof document !== 'undefined' && document.pictureInPictureElement) {
      try {
        await document.exitPictureInPicture();
      } catch {
        // ignore
      }
    }
    setIsFloatingInApp(false);
    setIsPipActive(false);
    onPipStateChange?.(false);
  }, [onPipStateChange]);

  // Open PiP HUD (Native OS PiP on supported Android/Desktop; 60 FPS In-App ribbon on iOS & fallback)
  const openPip = useCallback(async () => {
    const prefs = getPipPreferences();
    const isIos = isPlatformIos();
    const forceInApp = isIos || prefs.preferredMode === 'in_app';
    const canvas = canvasRef.current;
    const video = videoRef.current;

    // 1. Try Native OS PiP if available (Desktop, Android Chrome)
    if (!forceInApp && nativePipAvailable && canvas && video) {
      try {
        if (!streamRef.current && typeof canvas.captureStream === 'function') {
          const stream = canvas.captureStream(30);
          streamRef.current = stream;
          video.srcObject = stream;
        }

        await video.play();

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
  }, [nativePipAvailable, onPipStateChange]);

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
      {/* 60 FPS Floating In-App HUD Ribbon Container (Single Persistent DOM Node) */}
      <div
        style={{
          position: 'fixed',
          ...(isFloatingInApp
            ? {
                ...(hudDockPosition === 'bottom'
                  ? { bottom: 'calc(160px + env(safe-area-inset-bottom, 0px))' }
                  : { top: 'calc(118px + env(safe-area-inset-top, 0px))' }),
                left: '50%',
                transform: 'translateX(-50%)',
                width: 'min(94vw, 420px)',
                zIndex: 9999,
                opacity: 1,
                pointerEvents: 'auto',
                visibility: 'visible',
              }
            : {
                top: -9999,
                left: -9999,
                width: 420,
                opacity: 0,
                pointerEvents: 'none',
                visibility: 'hidden',
              }),
          backgroundColor: 'rgba(9, 11, 14, 0.96)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1.5px solid rgba(240, 194, 58, 0.8)',
          borderRadius: 16,
          padding: 8,
          boxSizing: 'border-box',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.8), 0 0 15px rgba(240, 194, 58, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          touchAction: 'manipulation',
          transition: 'opacity 0.15s ease',
        }}
      >
        {/* Header strip: Title, Dock position switch, Close */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '2px 4px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13 }}>📺</span>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 900,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: 'var(--pz-accent, #F0C23A)',
              }}
            >
              Convoy Floating HUD
            </span>
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                color: '#10B981',
                borderRadius: 10,
                padding: '1px 6px',
              }}
            >
              60 FPS
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={handleDockToggle}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#FFFFFF',
                borderRadius: 8,
                padding: '3px 8px',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                touchAction: 'manipulation',
              }}
              title={hudDockPosition === 'bottom' ? 'Dock to top' : 'Dock to bottom'}
            >
              {hudDockPosition === 'bottom' ? '⬆ Dock Top' : '⬇ Dock Bottom'}
            </button>

            <button
              type="button"
              onClick={closePip}
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid #EF4444',
                color: '#EF4444',
                fontSize: 12,
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

        {/* Persistent 60 FPS Canvas in Ribbon Ratio */}
        <canvas
          ref={canvasRef}
          width={420}
          height={155}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            borderRadius: 12,
            background: '#090B0E',
          }}
        />
      </div>

      {/* Hidden Video element feeding Native PiP window if triggered */}
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        style={{
          position: 'fixed',
          top: -9999,
          left: -9999,
          width: 10,
          height: 10,
          opacity: 0.01,
          pointerEvents: 'none',
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

export default PictureInPictureHud;
