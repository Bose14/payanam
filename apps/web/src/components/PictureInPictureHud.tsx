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
  return `${(meters / 1000).toFixed(1)} km`;
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

  // 60 FPS Canvas Drawing Engine with Relative Ahead / Behind Positions
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
      tripTitle: title,
    } = stateRef.current;

    // Background: Deep Obsidian
    ctx.fillStyle = '#0B0D11';
    ctx.fillRect(0, 0, width, height);

    // Outer Glow Border
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = sos ? '#EF4444' : '#F0C23A';
    ctx.strokeRect(1.5, 1.5, width - 3, height - 3);

    // --- 1. TOP BAR: Live Status, Speedometer, Clock (0 - 44px) ---
    const pulse = (Math.sin(time / 180) + 1) / 2;
    const liveRiders = riderList.filter((r) => r.isLive !== false).length;
    const greenRadius = 4 + pulse * 2;

    // Live beacon
    ctx.fillStyle = '#10B981';
    ctx.beginPath();
    ctx.arc(20, 24, greenRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.font = 'bold 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#10B981';
    ctx.fillText(`${liveRiders} LIVE`, 32, 28);

    // Speedometer (Center)
    const roundedSpeed = Math.round(speed || 0);
    ctx.textAlign = 'center';
    ctx.font = '900 30px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`${roundedSpeed}`, width / 2 - 16, 32);

    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#F0C23A';
    ctx.fillText('KM/H', width / 2 + 26, 32);

    // Digital Clock (Right)
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    ctx.textAlign = 'right';
    ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#9D9C9A';
    ctx.fillText(timeStr, width - 16, 27);

    // Divider
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#1E232B';
    ctx.beginPath();
    ctx.moveTo(12, 44);
    ctx.lineTo(width - 12, 44);
    ctx.stroke();

    // --- 2. FELLOW RIDERS IN FRONT (▲ AHEAD) (48 - 104px) ---
    const ridersAhead = riderList
      .filter((r) => !r.isMe && (r.relativePosition === 'ahead' || ((r.relativeDistanceMeters ?? 0) > 0 && r.relativePosition !== 'behind')))
      .sort((a, b) => (a.relativeDistanceMeters ?? 0) - (b.relativeDistanceMeters ?? 0));

    ctx.fillStyle = '#141820';
    ctx.strokeStyle = '#222834';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(12, 48, width - 24, 56, 8);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.font = '900 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#10B981';
    ctx.fillText(`▲ IN FRONT OF YOU (${ridersAhead.length})`, 22, 64);

    if (ridersAhead.length === 0) {
      ctx.font = '600 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#F0C23A';
      ctx.fillText('👑 You are in the lead · No fellow riders ahead', 22, 86);
    } else {
      const first = ridersAhead[0];
      const second = ridersAhead[1];

      // First rider ahead
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      const capTag1 = first.isCaptain ? '👑 ' : '';
      const name1 = first.userName.length > 10 ? `${first.userName.slice(0, 9)}…` : first.userName;
      ctx.fillText(`${capTag1}${name1}:`, 22, 86);

      ctx.font = '900 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#10B981';
      ctx.fillText(`${formatDist(first.relativeDistanceMeters)} ▲`, 116, 86);

      if (first.speedKmh != null && first.speedKmh > 0) {
        ctx.font = '600 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = '#9D9C9A';
        ctx.fillText(`(${Math.round(first.speedKmh)} km/h)`, 180, 86);
      }

      // Second rider ahead (if exists)
      if (second) {
        ctx.textAlign = 'right';
        ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = '#FFFFFF';
        const capTag2 = second.isCaptain ? '👑 ' : '';
        const name2 = second.userName.length > 8 ? `${second.userName.slice(0, 7)}…` : second.userName;
        ctx.fillText(`${capTag2}${name2}: `, width - 85, 86);

        ctx.font = '900 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = '#10B981';
        ctx.fillText(`${formatDist(second.relativeDistanceMeters)} ▲`, width - 22, 86);
      }
    }

    // --- 3. FELLOW RIDERS BEHIND (▼ BEHIND) (108 - 164px) ---
    const ridersBehind = riderList
      .filter((r) => !r.isMe && (r.relativePosition === 'behind' || ((r.relativeDistanceMeters ?? 0) < 0)))
      .sort((a, b) => (a.relativeDistanceMeters ?? 0) - (b.relativeDistanceMeters ?? 0));

    ctx.fillStyle = '#141820';
    ctx.strokeStyle = '#222834';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(12, 108, width - 24, 56, 8);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.font = '900 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#F59E0B';
    ctx.fillText(`▼ BEHIND YOU (${ridersBehind.length})`, 22, 124);

    if (ridersBehind.length === 0) {
      ctx.font = '600 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#9D9C9A';
      ctx.fillText('🏁 You are at the tail · No fellow riders behind', 22, 146);
    } else {
      const first = ridersBehind[0];
      const second = ridersBehind[1];

      // First rider behind
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      const isFirstLagging = (first.relativeDistanceMeters ?? 0) > 1200;
      const warnTag1 = isFirstLagging ? '⚠️ ' : '';
      const name1 = first.userName.length > 10 ? `${first.userName.slice(0, 9)}…` : first.userName;
      ctx.fillText(`${warnTag1}${name1}:`, 22, 146);

      ctx.font = '900 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = isFirstLagging ? '#EF4444' : '#F59E0B';
      ctx.fillText(`${formatDist(first.relativeDistanceMeters)} ▼`, 116, 146);

      if (first.speedKmh != null && first.speedKmh > 0) {
        ctx.font = '600 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = '#9D9C9A';
        ctx.fillText(`(${Math.round(first.speedKmh)} km/h)`, 180, 146);
      }

      // Second rider behind (if exists)
      if (second) {
        ctx.textAlign = 'right';
        ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = '#FFFFFF';
        const isSecondLagging = (second.relativeDistanceMeters ?? 0) > 1200;
        const warnTag2 = isSecondLagging ? '⚠️ ' : '';
        const name2 = second.userName.length > 8 ? `${second.userName.slice(0, 7)}…` : second.userName;
        ctx.fillText(`${warnTag2}${name2}: `, width - 85, 146);

        ctx.font = '900 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = isSecondLagging ? '#EF4444' : '#F59E0B';
        ctx.fillText(`${formatDist(second.relativeDistanceMeters)} ▼`, width - 22, 146);
      }
    }

    // --- 4. CONVOY RADAR RAIL (168 - 198px) ---
    const railY = 184;
    const railLeft = 24;
    const railRight = width - 24;
    const railWidth = railRight - railLeft;

    // Track rail background
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#1E2430';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(railLeft, railY);
    ctx.lineTo(railRight, railY);
    ctx.stroke();

    // Rider Pips along rail with YOU highlighted
    riderList.forEach((r, idx) => {
      const pct = Math.min(95, Math.max(5, r.progressPercent ?? (25 + idx * 15)));
      const pipX = railLeft + (railWidth * pct) / 100;

      if (r.isMe) {
        // Pulsing glow for YOU
        ctx.fillStyle = 'rgba(240, 194, 58, 0.35)';
        ctx.beginPath();
        ctx.arc(pipX, railY, 8 + pulse * 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#F0C23A';
        ctx.beginPath();
        ctx.arc(pipX, railY, 5, 0, Math.PI * 2);
        ctx.fill();

        // "YOU" Label
        ctx.textAlign = 'center';
        ctx.font = '900 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = '#F0C23A';
        ctx.fillText('YOU', pipX, railY - 10);
      } else {
        ctx.fillStyle = r.isCaptain ? '#F59E0B' : r.relativePosition === 'ahead' ? '#10B981' : '#3B82F6';
        ctx.beginPath();
        ctx.arc(pipX, railY, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // --- 5. BOTTOM SECTION: Next Stop or Urgent Alert (202 - 258px) ---
    ctx.textAlign = 'left';

    if (sos) {
      // 🚨 Flashing SOS Alert Card
      const sosPulse = (Math.sin(time / 120) + 1) / 2;
      ctx.fillStyle = `rgba(239, 68, 68, ${0.15 + sosPulse * 0.25})`;
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(12, 202, width - 24, 56, 8);
      ctx.fill();
      ctx.stroke();

      ctx.font = '900 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('🚨 SOS ALERT — RIDER NEEDS HELP!', 22, 224);

      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('Fellow rider reported emergency on road', 22, 244);
    } else if (announcement) {
      // 📢 Captain Announcement Banner
      ctx.fillStyle = 'rgba(240, 194, 58, 0.15)';
      ctx.strokeStyle = '#F0C23A';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(12, 202, width - 24, 56, 8);
      ctx.fill();
      ctx.stroke();

      ctx.font = '900 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#F0C23A';
      ctx.fillText(`📢 CAPTAIN: ${announcement.message.slice(0, 38)}`, 22, 224);

      ctx.font = 'bold 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#9D9C9A';
      ctx.fillText(title || 'Payanam Convoy', 22, 244);
    } else if (stop) {
      // 📌 Next Pinned Stop Card
      ctx.fillStyle = '#141820';
      ctx.strokeStyle = '#222834';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(12, 202, width - 24, 56, 8);
      ctx.fill();
      ctx.stroke();

      // Disc icon
      ctx.fillStyle = 'rgba(240, 194, 58, 0.2)';
      ctx.beginPath();
      ctx.arc(32, 230, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(stop.type === 'fuel' ? '⛽' : stop.type === 'food' ? '🍲' : '📌', 25, 235);

      // Stop Name
      ctx.font = '900 13.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      const stopName = stop.name.length > 24 ? `${stop.name.slice(0, 22)}…` : stop.name;
      ctx.fillText(stopName, 54, 224);

      // Distance & Arrival Counter
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#F0C23A';
      const distStr = stopDist != null ? `${stopDist.toFixed(1)} km away` : 'Next Target';
      ctx.fillText(`${distStr} · ${arrived}/${Math.max(total, 1)} arrived`, 54, 244);
    } else {
      // No stop pinned placeholder
      ctx.fillStyle = '#141820';
      ctx.strokeStyle = '#222834';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(12, 202, width - 24, 56, 8);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('No target stop pinned', 24, 224);

      ctx.font = '600 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#9D9C9A';
      ctx.fillText('Convoy synchronized · Stay safe on road', 24, 244);
    }
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
      {/* Hidden Offscreen 60 FPS Canvas (480x270 for native 16:9 widescreen HUD) */}
      <canvas
        ref={canvasRef}
        width={480}
        height={270}
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
            backgroundColor: isPipActive ? 'rgba(240, 194, 58, 0.25)' : 'rgba(27, 30, 35, 0.88)',
            backdropFilter: 'blur(10px)',
            border: isPipActive ? '1.5px solid var(--pz-accent, #F0C23A)' : '1px solid var(--pz-line, #2A2E35)',
            color: isPipActive ? 'var(--pz-accent, #F0C23A)' : 'var(--pz-ink, #FFFFFF)',
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
