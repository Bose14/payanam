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
        hintTimeoutRef.current = window.setTimeout(() => setShowHint(false), 2400);
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
      hintTimeoutRef.current = window.setTimeout(() => setShowHint(false), 2000);
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
  const size = 62;
  const strokeWidth = 3.5;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (holdProgress / 100) * circumference;

  return (
    <aside
      aria-label="Screen touch lock active: touch input is blocked"
      onTouchStart={handleGhostTouch}
      onTouchMove={handleGhostTouch}
      onTouchEnd={handleGhostTouch}
      onClick={handleGhostTouch}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'transparent', // 100% transparent: every piece of ride data & map is completely visible
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 'calc(10px + env(safe-area-inset-top, 0px)) 16px calc(16px + env(safe-area-inset-bottom, 0px)) 16px',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        pointerEvents: 'auto', // intercepts all touches across the entire screen
        boxSizing: 'border-box',
      }}
    >
      {/* Subtle HUD Corner Brackets to give visual indicator that screen is locked */}
      <div style={{ position: 'absolute', top: 8, left: 8, width: 16, height: 16, borderTop: '2px solid rgba(240, 194, 58, 0.6)', borderLeft: '2px solid rgba(240, 194, 58, 0.6)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 8, right: 8, width: 16, height: 16, borderTop: '2px solid rgba(240, 194, 58, 0.6)', borderRight: '2px solid rgba(240, 194, 58, 0.6)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 8, left: 8, width: 16, height: 16, borderBottom: '2px solid rgba(240, 194, 58, 0.6)', borderLeft: '2px solid rgba(240, 194, 58, 0.6)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 8, right: 8, width: 16, height: 16, borderBottom: '2px solid rgba(240, 194, 58, 0.6)', borderRight: '2px solid rgba(240, 194, 58, 0.6)', pointerEvents: 'none' }} />

      {/* TOP COMPACT LOCK BADGE: Minimal floating pill, leaves 100% of the screen data visible */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          backgroundColor: 'rgba(10, 13, 18, 0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1.2px solid var(--pz-accent, #F0C23A)',
          borderRadius: 20,
          padding: '4px 12px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5), 0 0 8px rgba(240, 194, 58, 0.2)',
          pointerEvents: 'none',
          color: '#FFFFFF',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 0.5,
        }}
      >
        <span style={{ color: 'var(--pz-accent, #F0C23A)', display: 'flex', alignItems: 'center', fontSize: 12 }}>
          <Icon name="lock" />
        </span>
        <span style={{ textTransform: 'uppercase', color: 'var(--pz-accent, #F0C23A)' }}>
          Touch Locked
        </span>
        <span style={{ color: 'rgba(255, 255, 255, 0.4)', margin: '0 2px' }}>·</span>
        <span style={{ fontSize: 10, color: 'rgba(255, 255, 255, 0.85)' }}>
          All data live
        </span>
      </div>

      {/* TRANSIENT TOAST: Pops up ONLY when an accidental touch occurs, auto-fades in 2s */}
      <div
        style={{
          pointerEvents: 'none',
          transition: 'all 0.18s ease',
          opacity: showHint || isPressing ? 1 : 0,
          transform: showHint || isPressing ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(6px)',
          marginBottom: 12,
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(15, 18, 24, 0.92)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1.5px solid var(--pz-warn, #F59E0B)',
            borderRadius: 14,
            padding: '8px 16px',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            maxWidth: 300,
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: 16 }}>🔒</span>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#FFFFFF' }}>
            {isPressing
              ? `Unlocking... ${holdProgress}%`
              : 'Touch blocked · Hold lock button below to unlock'}
          </div>
        </div>
      </div>

      {/* BOTTOM UNLOCK BUTTON: Sleek, non-intrusive 62px disc positioned above bottom edge */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          pointerEvents: 'auto',
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
            transform: isPressing ? 'scale(1.08)' : 'scale(1)',
            transition: 'transform 0.12s ease',
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
              stroke="rgba(255, 255, 255, 0.2)"
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
                transition: isPressing ? 'stroke-dashoffset 0.03s linear' : 'stroke-dashoffset 0.18s ease',
              }}
            />
          </svg>

          {/* Central Button Disc */}
          <div
            style={{
              width: size - 12,
              height: size - 12,
              borderRadius: '50%',
              backgroundColor: isPressing ? 'var(--pz-warn-bg, rgba(240, 194, 58, 0.25))' : 'rgba(15, 18, 24, 0.9)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1.5px solid var(--pz-accent, #F0C23A)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              color: 'var(--pz-accent, #F0C23A)',
              boxShadow: isPressing
                ? '0 0 18px rgba(240, 194, 58, 0.6)'
                : '0 4px 14px rgba(0, 0, 0, 0.6)',
              pointerEvents: 'none',
            }}
          >
            <Icon name="lock" />
          </div>
        </div>

        {/* Caption */}
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            letterSpacing: 0.4,
            color: isPressing ? 'var(--pz-accent, #F0C23A)' : 'rgba(255, 255, 255, 0.85)',
            textShadow: '0 2px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.8)',
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            padding: '2px 8px',
            borderRadius: 10,
            pointerEvents: 'none',
          }}
        >
          {isPressing ? `Hold steady (${holdProgress}%)` : 'Hold to unlock'}
        </div>
      </div>
    </aside>
  );
};

export default ScreenTouchLockOverlay;
