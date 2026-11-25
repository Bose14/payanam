import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PinnedStopData } from './PinStopModal';

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
  const [isSupported, setIsSupported] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

  // Check PiP browser support
  useEffect(() => {
    const hasVideoPip = typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && Boolean(document.pictureInPictureEnabled);
    const hasDocPip = typeof window !== 'undefined' && 'documentPictureInPicture' in window;
    setIsSupported(hasVideoPip || hasDocPip);
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

  // Video PiP Handler
  const togglePip = useCallback(async () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!canvas || !video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPipActive(false);
        onPipStateChange?.(false);
        return;
      }

      if (!streamRef.current) {
        const stream = canvas.captureStream(60);
        streamRef.current = stream;
        video.srcObject = stream;
      }

      await video.play();
      await video.requestPictureInPicture();
      setIsPipActive(true);
      onPipStateChange?.(true);
    } catch (err) {
      console.warn('[PiP HUD] Failed to toggle Picture-in-Picture:', err);
    }
  }, [onPipStateChange]);

  // Handle PiP event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onEnter = () => {
      setIsPipActive(true);
      onPipStateChange?.(true);
    };

    const onLeave = () => {
      setIsPipActive(false);
      onPipStateChange?.(false);
    };

    video.addEventListener('enterpictureinpicture', onEnter);
    video.addEventListener('leavepictureinpicture', onLeave);

    return () => {
      video.removeEventListener('enterpictureinpicture', onEnter);
      video.removeEventListener('leavepictureinpicture', onLeave);
    };
  }, [onPipStateChange]);

  return (
    <>
      {/* Hidden Offscreen 60 FPS Canvas (420x155 for sleek non-intrusive mobile ribbon ratio) */}
      <canvas
        ref={canvasRef}
        width={420}
        height={155}
        style={{
          position: 'fixed',
          top: -9999,
          left: -9999,
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
      />

      {/* Hidden Video element feeding the PiP window */}
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        style={{
          position: 'fixed',
          top: -9999,
          left: -9999,
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Custom or Default Trigger Button */}
      {renderTrigger ? (
        renderTrigger({ isPipActive, togglePip, isSupported })
      ) : (
        <button
          type="button"
          onClick={togglePip}
          disabled={!isSupported}
          style={{
            backgroundColor: isPipActive ? 'var(--pz-warn-bg)' : 'rgba(27, 30, 35, 0.88)',
            backdropFilter: 'blur(10px)',
            border: isPipActive ? '1.5px solid var(--pz-accent, var(--pz-accent))' : '1px solid var(--pz-line, var(--pz-line))',
            color: isPipActive ? 'var(--pz-accent, var(--pz-accent))' : 'var(--pz-ink, #FFFFFF)',
            borderRadius: 20,
            padding: '5px 12px',
            fontSize: 11,
            fontWeight: 800,
            cursor: isSupported ? 'pointer' : 'not-allowed',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)',
            opacity: isSupported ? 1 : 0.5,
            transition: 'all 0.15s ease',
          }}
          title={isPipActive ? 'Close Picture-in-Picture HUD' : 'Open 60 FPS Picture-in-Picture Convoy HUD'}
        >
          <span>📺</span>
          <span>{isPipActive ? 'PiP Active' : 'PiP HUD'}</span>
        </button>
      )}
    </>
  );
};

export default PictureInPictureHud;
