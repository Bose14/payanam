import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PinnedStopData } from './PinStopModal';

export interface PipRiderData {
  userId: string;
  userName: string;
  speedKmh?: number;
  isCaptain?: boolean;
  isMe?: boolean;
  isLive?: boolean;
  distanceKm?: number;
  progressPercent?: number;
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

  // 60 FPS Canvas Drawing Engine
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

    // Background: Deep Obsidian with subtle corner vignette
    ctx.fillStyle = '#0F1216';
    ctx.fillRect(0, 0, width, height);

    // Subtle Outer Glow Border
    ctx.lineWidth = 3;
    ctx.strokeStyle = sos ? '#EF4444' : '#F0C23A';
    ctx.strokeRect(1.5, 1.5, width - 3, height - 3);

    // --- TOP BAR: Status, Speedometer, Clock ---
    // 1. Live Indicator with 60 FPS Pulse
    const pulse = (Math.sin(time / 180) + 1) / 2;
    const liveRiders = riderList.filter((r) => r.isLive !== false).length;
    const greenRadius = 4 + pulse * 2;

    ctx.fillStyle = '#10B981';
    ctx.beginPath();
    ctx.arc(22, 26, greenRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#10B981';
    ctx.fillText(`${liveRiders} LIVE`, 34, 30);

    // 2. Speed Gauge Readout (Center)
    const roundedSpeed = Math.round(speed || 0);
    ctx.textAlign = 'center';
    ctx.font = '900 34px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`${roundedSpeed}`, width / 2 - 16, 36);

    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#F0C23A';
    ctx.fillText('KM/H', width / 2 + 28, 36);

    // 3. Digital Clock (Right)
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    ctx.textAlign = 'right';
    ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#9D9C9A';
    ctx.fillText(timeStr, width - 18, 30);

    // Divider Line
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#22262E';
    ctx.beginPath();
    ctx.moveTo(14, 48);
    ctx.lineTo(width - 14, 48);
    ctx.stroke();

    // --- MIDDLE SECTION: Convoy Spacing & Micro Rail ---
    ctx.textAlign = 'left';

    // Captain spacing info
    const captain = riderList.find((r) => r.isCaptain);
    const me = riderList.find((r) => r.isMe);
    let leadText = '👑 Captain: Convoy Lead';
    if (me?.isCaptain) {
      leadText = '👑 You are Captain';
    } else if (captain) {
      const capDist = captain.distanceKm != null ? `${(captain.distanceKm * 1000).toFixed(0)}m` : 'ahead';
      leadText = `👑 ${captain.userName}: +${capDist} ▲`;
    }

    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#F0C23A';
    ctx.fillText(leadText, 18, 70);

    // Tail / Lagging Rider status
    const tailRider = riderList.slice().sort((a, b) => (a.progressPercent ?? 0) - (b.progressPercent ?? 0))[0];
    ctx.textAlign = 'right';
    if (tailRider && !tailRider.isMe && (tailRider.progressPercent ?? 100) < (me?.progressPercent ?? 0) - 5) {
      ctx.fillStyle = '#EF4444';
      ctx.fillText(`⚠️ ${tailRider.userName}: lagging ▼`, width - 18, 70);
    } else {
      ctx.fillStyle = '#10B981';
      ctx.fillText('✓ Convoy Tight', width - 18, 70);
    }

    // --- MICRO CONVOY RAIL (Horizontal animated track) ---
    const railY = 100;
    const railLeft = 24;
    const railRight = width - 24;
    const railWidth = railRight - railLeft;

    // Track background
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#1F242D';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(railLeft, railY);
    ctx.lineTo(railRight, railY);
    ctx.stroke();

    // Active progress line
    const avgProgress = riderList.length > 0
      ? riderList.reduce((acc, r) => acc + (r.progressPercent ?? 30), 0) / riderList.length
      : 40;
    const activeFillX = railLeft + (railWidth * Math.min(100, Math.max(5, avgProgress))) / 100;

    ctx.strokeStyle = '#F0C23A';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(railLeft, railY);
    ctx.lineTo(activeFillX, railY);
    ctx.stroke();

    // Rider Pips along rail
    riderList.forEach((r, idx) => {
      const pct = Math.min(95, Math.max(5, r.progressPercent ?? (25 + idx * 15)));
      const pipX = railLeft + (railWidth * pct) / 100;

      // Glow ring for current user
      if (r.isMe) {
        ctx.fillStyle = 'rgba(240, 194, 58, 0.4)';
        ctx.beginPath();
        ctx.arc(pipX, railY, 8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = r.isCaptain ? '#F0C23A' : r.isMe ? '#10B981' : '#3B82F6';
      ctx.beginPath();
      ctx.arc(pipX, railY, r.isMe ? 5 : 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // --- BOTTOM SECTION: Next Pinned Stop or Emergency Alert ---
    ctx.textAlign = 'left';

    if (sos) {
      // 🚨 Flashing SOS Alert Card
      const sosPulse = (Math.sin(time / 120) + 1) / 2;
      ctx.fillStyle = `rgba(239, 68, 68, ${0.15 + sosPulse * 0.25})`;
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(14, 126, width - 28, 68, 12);
      ctx.fill();
      ctx.stroke();

      ctx.font = '900 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('🚨 SOS ALERT — RIDER NEEDS HELP!', 28, 154);

      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('Check group map immediately', 28, 176);
    } else if (announcement) {
      // 📢 Captain Announcement Banner
      ctx.fillStyle = 'rgba(240, 194, 58, 0.15)';
      ctx.strokeStyle = '#F0C23A';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(14, 126, width - 28, 68, 12);
      ctx.fill();
      ctx.stroke();

      ctx.font = '900 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#F0C23A';
      ctx.fillText(`📢 CAPTAIN: ${announcement.message.slice(0, 36)}`, 26, 154);

      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#9D9C9A';
      ctx.fillText(title || 'Payanam Convoy', 26, 176);
    } else if (stop) {
      // 📌 Next Pinned Stop Card
      ctx.fillStyle = '#171A20';
      ctx.strokeStyle = '#2A2E35';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(14, 122, width - 28, 72, 12);
      ctx.fill();
      ctx.stroke();

      // Disc icon
      ctx.fillStyle = 'rgba(240, 194, 58, 0.2)';
      ctx.beginPath();
      ctx.arc(36, 158, 16, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(stop.type === 'fuel' ? '⛽' : stop.type === 'food' ? '🍲' : '📌', 28, 164);

      // Stop Name
      ctx.font = '900 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      const stopName = stop.name.length > 22 ? `${stop.name.slice(0, 20)}…` : stop.name;
      ctx.fillText(stopName, 60, 150);

      // Distance & Arrival Counter
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#F0C23A';
      const distStr = stopDist != null ? `${stopDist.toFixed(1)} km away` : 'Next Target';
      ctx.fillText(`${distStr} · ${arrived}/${Math.max(total, 1)} arrived`, 60, 172);
    } else {
      // No stop pinned placeholder
      ctx.fillStyle = '#171A20';
      ctx.strokeStyle = '#2A2E35';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(14, 122, width - 28, 72, 12);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('No target stop pinned', 28, 152);

      ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#9D9C9A';
      ctx.fillText('Trip itinerary active · Stay safe on road', 28, 174);
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
      // If PiP is currently active, exit it
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPipActive(false);
        onPipStateChange?.(false);
        return;
      }

      // Initialize media stream from 60 FPS canvas if not ready
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
      {/* Hidden Offscreen 60 FPS Canvas (480x210 for widescreen HUD) */}
      <canvas
        ref={canvasRef}
        width={480}
        height={210}
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
