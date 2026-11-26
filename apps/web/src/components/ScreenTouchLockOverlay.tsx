import React, { useState, useRef, useEffect, useCallback } from 'react';
import Icon from './Icon';

export interface ScreenTouchLockOverlayProps {
  isLocked: boolean;
  onUnlock: () => void;
  currentSpeedKmh?: number;
  tripTitle?: string;
  pinnedStopName?: string;
  distToPinnedStopKm?: number | null;
}

export const ScreenTouchLockOverlay: React.FC<ScreenTouchLockOverlayProps> = ({
  isLocked,
  onUnlock,
  currentSpeedKmh,
  pinnedStopName,
  distToPinnedStopKm,
}) => {
  const [holdProgress, setHoldProgress] = useState(0); // 0 to 100
  const [showHint, setShowHint] = useState(false);
  const [isPressing, setIsPressing] = useState(false);

  const holdTimerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const hintTimeoutRef = useRef<number | null>(null);

  const HOLD_DURATION_MS = 1200; // 1.2 seconds deliberate hold to unlock

  const triggerHaptic = useCallback((pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // ignore
      }
    }
  }, []);

  const handleStartHold = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      triggerHaptic(25);
      startTimeRef.current = Date.now();
      setIsPressing(true);
      setHoldProgress(0);

      if (holdTimerRef.current) clearInterval(holdTimerRef.current);

      holdTimerRef.current = window.setInterval(() => {
        if (!startTimeRef.current) return;
        const elapsed = Date.now() - startTimeRef.current;
        const pct = Math.min(100, Math.round((elapsed / HOLD_DURATION_MS) * 100));
        setHoldProgress(pct);

        // Gentle haptic feedback ticks during hold
        if (pct === 35 || pct === 70) {
          triggerHaptic(15);
        }

        if (pct >= 100) {
          if (holdTimerRef.current) clearInterval(holdTimerRef.current);
          holdTimerRef.current = null;
          startTimeRef.current = null;
          setIsPressing(false);
          setHoldProgress(0);
          triggerHaptic([40, 60, 40]);
          onUnlock();
        }
      }, 20);
    },
    [onUnlock, triggerHaptic]
  );

  const handleEndHold = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (holdTimerRef.current) {
        clearInterval(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      startTimeRef.current = null;
      setIsPressing(false);

      if (holdProgress > 5 && holdProgress < 100) {
        // Released too early -> flash hint
        setShowHint(true);
        triggerHaptic(15);
        if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
        hintTimeoutRef.current = window.setTimeout(() => setShowHint(false), 2600);
      }

      setHoldProgress(0);
    },
    [holdProgress, triggerHaptic]
  );

  const handleGhostTouch = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Accidental pouch touch detected outside the unlock button
      setShowHint(true);
      triggerHaptic(12);
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
      hintTimeoutRef.current = window.setTimeout(() => setShowHint(false), 2400);
    },
    [triggerHaptic]
  );

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearInterval(holdTimerRef.current);
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
    };
  }, []);

  if (!isLocked) return null;

  // SVG Circular Gauge
  const size = 78;
  const strokeWidth = 4;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (holdProgress / 100) * circumference;

  return (
    <aside
      aria-label="Screen touch lock overlay"
      onTouchStart={handleGhostTouch}
      onTouchMove={handleGhostTouch}
      onTouchEnd={handleGhostTouch}
      onClick={handleGhostTouch}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(5, 8, 16, 0.22)',
        backdropFilter: 'blur(1px)',
        WebkitBackdropFilter: 'blur(1px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 'calc(14px + env(safe-area-inset-top, 0px)) 16px calc(24px + env(safe-area-inset-bottom, 0px)) 16px',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        pointerEvents: 'auto',
      }}
    >
      {/* Viewfinder HUD Corner Brackets to give visual confirmation of locked HUD mode */}
      <div style={{ position: 'absolute', top: 12, left: 12, width: 22, height: 22, borderTop: '2px solid rgba(240, 194, 58, 0.7)', borderLeft: '2px solid rgba(240, 194, 58, 0.7)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 12, right: 12, width: 22, height: 22, borderTop: '2px solid rgba(240, 194, 58, 0.7)', borderRight: '2px solid rgba(240, 194, 58, 0.7)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 12, left: 12, width: 22, height: 22, borderBottom: '2px solid rgba(240, 194, 58, 0.7)', borderLeft: '2px solid rgba(240, 194, 58, 0.7)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 12, right: 12, width: 22, height: 22, borderBottom: '2px solid rgba(240, 194, 58, 0.7)', borderRight: '2px solid rgba(240, 194, 58, 0.7)', pointerEvents: 'none' }} />

      {/* TOP STATUS BAR: Glanceable Live Telemetry & Lock Confirmation */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(17, 19, 22, 0.92)',
            border: '1.5px solid var(--pz-accent, #F0C23A)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6), 0 0 12px rgba(240, 194, 58, 0.25)',
            borderRadius: 999,
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--pz-accent, #F0C23A)', display: 'flex', alignItems: 'center' }}>
              <Icon name="lock" />
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: 'var(--pz-accent, #F0C23A)',
              }}
            >
              Touch Locked
            </span>
          </div>

          <div style={{ width: 1, height: 14, backgroundColor: 'rgba(255, 255, 255, 0.2)' }} />

          {/* Speedometer */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: '#FFFFFF' }}>
              {Math.round(currentSpeedKmh || 0)}
            </span>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--pz-muted, #9D9C9A)' }}>
              KM/H
            </span>
          </div>

          <div style={{ width: 1, height: 14, backgroundColor: 'rgba(255, 255, 255, 0.2)' }} />

          {/* GPS Live Dot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: 'var(--pz-ok, #10B981)',
                boxShadow: '0 0 8px var(--pz-ok, #10B981)',
              }}
            />
            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--pz-ok, #10B981)' }}>
              GPS LIVE
            </span>
          </div>
        </div>

        {/* Pinned next stop info if active */}
        {pinnedStopName && (
          <div
            style={{
              backgroundColor: 'rgba(17, 19, 22, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 20,
              padding: '3px 10px',
              fontSize: 10.5,
              fontWeight: 700,
              color: 'var(--pz-ink, #FFFFFF)',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span>📌</span>
            <span>{pinnedStopName}</span>
            {distToPinnedStopKm != null && (
              <span style={{ color: 'var(--pz-accent, #F0C23A)' }}>
                · {distToPinnedStopKm.toFixed(1)} km
              </span>
            )}
          </div>
        )}
      </div>

      {/* CENTER HINT NOTIFICATION: Pops up when accidental pouch/ghost touches occur */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          transition: 'all 0.2s ease',
          opacity: showHint || isPressing ? 1 : 0,
          transform: showHint || isPressing ? 'scale(1)' : 'scale(0.95)',
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(17, 19, 22, 0.94)',
            border: '1.5px solid var(--pz-warn, #F59E0B)',
            borderRadius: 16,
            padding: '10px 18px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            maxWidth: 320,
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: 18, color: 'var(--pz-warn, #F59E0B)' }}>🛡️</span>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 900, color: '#FFFFFF' }}>
              Pouch Ghost Touches Blocked
            </div>
            <div style={{ fontSize: 11, color: 'var(--pz-muted, #9D9C9A)', marginTop: 2 }}>
              {isPressing
                ? `Hold steady... ${holdProgress}%`
                : 'Press & hold the lock disc below for 1s to unlock'}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM UNLOCK CONTROL: Glove & Pouch-Friendly Big Disc Button */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          width: '100%',
        }}
      >
        <div
          role="button"
          tabIndex={0}
          aria-label="Press and hold to unlock screen"
          onTouchStart={handleStartHold}
          onTouchEnd={handleEndHold}
          onTouchCancel={handleEndHold}
          onMouseDown={handleStartHold}
          onMouseUp={handleEndHold}
          onMouseLeave={handleEndHold}
          style={{
            position: 'relative',
            width: size,
            height: size,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            touchAction: 'none',
            pointerEvents: 'auto',
            transform: isPressing ? 'scale(1.06)' : 'scale(1)',
            transition: 'transform 0.15s ease',
          }}
        >
          {/* Circular SVG Gauge Track & Fill */}
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              transform: 'rotate(-90deg)',
              pointerEvents: 'none',
            }}
          >
            {/* Background Track Ring */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="rgba(255, 255, 255, 0.15)"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {/* Dynamic Animated Fill Gauge */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="var(--pz-accent, #F0C23A)"
              strokeWidth={strokeWidth + 1}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              style={{
                transition: isPressing ? 'stroke-dashoffset 0.03s linear' : 'stroke-dashoffset 0.2s ease',
              }}
            />
          </svg>

          {/* Central Button Disc */}
          <div
            style={{
              width: size - 14,
              height: size - 14,
              borderRadius: '50%',
              backgroundColor: isPressing ? 'var(--pz-warn-bg, rgba(240, 194, 58, 0.25))' : 'rgba(27, 30, 35, 0.95)',
              border: '1.5px solid var(--pz-accent, #F0C23A)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              color: 'var(--pz-accent, #F0C23A)',
              boxShadow: isPressing
                ? '0 0 20px rgba(240, 194, 58, 0.5)'
                : '0 4px 16px rgba(0, 0, 0, 0.6)',
              pointerEvents: 'none',
            }}
          >
            <Icon name="lock" />
          </div>
        </div>

        {/* Caption */}
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 800,
            letterSpacing: 0.4,
            color: isPressing ? 'var(--pz-accent, #F0C23A)' : 'rgba(255, 255, 255, 0.85)',
            textShadow: '0 2px 4px rgba(0,0,0,0.8)',
            pointerEvents: 'none',
          }}
        >
          {isPressing ? `Unlocking... ${holdProgress}%` : 'Hold 1.2s to Unlock'}
        </div>
      </div>
    </aside>
  );
};

export default ScreenTouchLockOverlay;
