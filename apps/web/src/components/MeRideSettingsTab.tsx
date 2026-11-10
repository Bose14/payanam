import React, { useState, useEffect } from 'react';
import { backgroundTrackingEngine, BackgroundTrackingStatus } from '../utils/backgroundTracking';

export interface MeRideSettingsTabProps {
  userName: string;
  userEmail?: string;
  batterySaver: boolean;
  onToggleBatterySaver: (enabled: boolean) => void;
  wakeLockActive?: boolean;
  onToggleWakeLock?: () => void;
  onReturnToRide: () => void;
  onEndRide?: () => void;
  isCaptain?: boolean;
}

export const MeRideSettingsTab: React.FC<MeRideSettingsTabProps> = ({
  userName,
  userEmail,
  batterySaver,
  onToggleBatterySaver,
  wakeLockActive,
  onToggleWakeLock,
  onReturnToRide,
  onEndRide,
  isCaptain,
}) => {
  const [trackingStatus, setTrackingStatus] = useState<BackgroundTrackingStatus>(
    () => backgroundTrackingEngine.getStatus()
  );
  const [copiedDiag, setCopiedDiag] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    const unsub = backgroundTrackingEngine.subscribe((st) => {
      setTrackingStatus(st);
    });
    return unsub;
  }, []);

  const handleCopyDiagnostics = async () => {
    const text = backgroundTrackingEngine.exportDiagnosticsText();
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedDiag(true);
      setTimeout(() => setCopiedDiag(false), 2500);
    } catch {
      setCopiedDiag(true);
      setTimeout(() => setCopiedDiag(false), 2500);
    }
  };
  return (
    <div style={styles.container}>
      {/* Top Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.avatar}>
            {userName ? userName.slice(0, 2).toUpperCase() : 'ME'}
          </div>
          <div>
            <h2 style={styles.userNameTitle}>
              {userName || 'Rider Profile'}
            </h2>
            <p style={styles.userSub}>
              {userEmail || (isCaptain ? 'Convoy Captain' : 'Active Rider')}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onReturnToRide}
          style={styles.backBtn}
        >
          Done
        </button>
      </div>

      <div style={styles.scrollContent}>
        {/* SECTION: Ride Settings (Feature D Signature) */}
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>RIDE SETTINGS</span>
          <span style={styles.sectionBadge}>COCKPIT</span>
        </div>

        {/* Feature D Card: Battery Saver Setting */}
        <div style={styles.settingCard}>
          <div style={styles.settingRow}>
            <div style={styles.settingTextWrap}>
              <div style={styles.settingLabelWrap}>
                <span style={styles.settingIcon}>🔋</span>
                <span style={styles.settingTitle}>Battery saver</span>
              </div>
              <p style={styles.settingSub}>
                Positions are sent about every 30 s instead of about every 10 s. Preserves phone battery on full-day rides.
              </p>
            </div>

            {/* Custom Toggle Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={batterySaver}
              onClick={() => onToggleBatterySaver(!batterySaver)}
              style={{
                ...styles.switchTrack,
                backgroundColor: batterySaver ? '#F0C23A' : '#2A2E35',
              }}
            >
              <div
                style={{
                  ...styles.switchThumb,
                  transform: batterySaver ? 'translateX(22px)' : 'translateX(2px)',
                }}
              />
            </button>
          </div>

          {/* Dynamic note explaining status */}
          <div style={{
            ...styles.settingFooterNote,
            borderColor: batterySaver ? 'rgba(240, 194, 58, 0.3)' : '#2A2E35',
            backgroundColor: batterySaver ? 'rgba(240, 194, 58, 0.08)' : '#16191D',
          }}>
            <span style={{ color: batterySaver ? '#F0C23A' : '#9D9C9A', fontWeight: 700 }}>
              {batterySaver
                ? '⚡ Active rate: 30s · The Ride tab shows a note that positions may be older.'
                : '⚡ Standard rate: 10s · Real-time high accuracy telemetry.'}
            </span>
          </div>
        </div>

        {/* Screen On / Wake Lock Setting */}
        {onToggleWakeLock && (
          <div style={styles.settingCard}>
            <div style={styles.settingRow}>
              <div style={styles.settingTextWrap}>
                <div style={styles.settingLabelWrap}>
                  <span style={styles.settingIcon}>🔆</span>
                  <span style={styles.settingTitle}>Keep screen awake</span>
                </div>
                <p style={styles.settingSub}>
                  Prevents screen from turning off while mounted on your handlebar.
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={Boolean(wakeLockActive)}
                onClick={onToggleWakeLock}
                style={{
                  ...styles.switchTrack,
                  backgroundColor: wakeLockActive ? '#10B981' : '#2A2E35',
                }}
              >
                <div
                  style={{
                    ...styles.switchThumb,
                    transform: wakeLockActive ? 'translateX(22px)' : 'translateX(2px)',
                  }}
                />
              </button>
            </div>
          </div>
        )}

        {/* SECTION: Background Tracking (Feature P1 Foundation) */}
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>BACKGROUND TRACKING</span>
          <span style={{
            ...styles.sectionBadge,
            backgroundColor: trackingStatus.isHeartbeatHealthy
              ? 'rgba(16, 185, 129, 0.15)'
              : (trackingStatus.isPaused ? 'rgba(239, 68, 68, 0.15)' : 'rgba(240, 194, 58, 0.12)'),
            color: trackingStatus.isHeartbeatHealthy
              ? '#10B981'
              : (trackingStatus.isPaused ? '#EF4444' : '#F0C23A'),
          }}>
            {trackingStatus.isPaused ? '⚠️ PAUSED' : (trackingStatus.isTracking ? '● HEALTHY' : 'STANDBY')}
          </span>
        </div>

        <div style={styles.settingCard}>
          {/* Header & Mode */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🛰️</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#F1EFEA' }}>
                  Reliability & Heartbeat
                </div>
                <div style={{ fontSize: 11, color: '#9D9C9A' }}>
                  {trackingStatus.platformMode}
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 8px',
              borderRadius: 8,
              backgroundColor: trackingStatus.isHeartbeatHealthy ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              border: `1px solid ${trackingStatus.isHeartbeatHealthy ? '#10B981' : '#EF4444'}`,
            }}>
              <span style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: trackingStatus.isHeartbeatHealthy ? '#10B981' : '#EF4444',
              }} />
              <span style={{
                fontSize: 10.5,
                fontWeight: 800,
                color: trackingStatus.isHeartbeatHealthy ? '#10B981' : '#EF4444',
              }}>
                {trackingStatus.isHeartbeatHealthy ? 'Heartbeat OK' : 'Watchdog Alert'}
              </span>
            </div>
          </div>

          <p style={{ margin: '0 0 12px', fontSize: 11.5, color: '#9D9C9A', lineHeight: 1.4 }}>
            Invisible in normal use. Heartbeat continuously monitors GPS fixes in background. The Ride tab alerts you immediately if tracking stops.
          </p>

          {/* Warning state if paused */}
          {trackingStatus.isPaused && (
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #EF4444',
              borderRadius: 12,
              padding: '10px 12px',
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#FCA5A5' }}>
                  ⚠️ Tracking paused
                </div>
                <div style={{ fontSize: 10.5, color: '#FCA5A5', marginTop: 2 }}>
                  {trackingStatus.pauseReason || 'Positions are no longer being recorded.'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => backgroundTrackingEngine.resumeTracking()}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#EF4444',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 900,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                Resume
              </button>
            </div>
          )}

          {/* Status Diagnostic Grid (Step 4: Status logged) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 8,
            marginBottom: 12,
          }}>
            <div style={{
              backgroundColor: '#16191D',
              border: '1px solid #2A2E35',
              borderRadius: 10,
              padding: '8px 10px',
            }}>
              <div style={{ fontSize: 10, color: '#9D9C9A', fontWeight: 700, textTransform: 'uppercase' }}>
                Last Position Fix
              </div>
              <div style={{ fontSize: 12, color: '#F1EFEA', fontWeight: 800, marginTop: 2 }}>
                {trackingStatus.lastFixTime
                  ? new Date(trackingStatus.lastFixTime).toLocaleTimeString()
                  : 'Awaiting fix'}
              </div>
              <div style={{ fontSize: 10, color: '#F0C23A', marginTop: 1 }}>
                {trackingStatus.lastFixCoords
                  ? `${trackingStatus.lastFixCoords.lat.toFixed(4)}, ${trackingStatus.lastFixCoords.lng.toFixed(4)}`
                  : 'No coordinates'}
              </div>
            </div>

            <div style={{
              backgroundColor: '#16191D',
              border: '1px solid #2A2E35',
              borderRadius: 10,
              padding: '8px 10px',
            }}>
              <div style={{ fontSize: 10, color: '#9D9C9A', fontWeight: 700, textTransform: 'uppercase' }}>
                Positions Recorded
              </div>
              <div style={{ fontSize: 12, color: '#F1EFEA', fontWeight: 800, marginTop: 2 }}>
                {trackingStatus.totalFixesRecorded} fixes
              </div>
              <div style={{ fontSize: 10, color: '#9D9C9A', marginTop: 1 }}>
                Watchdog: {trackingStatus.maxFixStallSec}s threshold
              </div>
            </div>
          </div>

          {/* Actions & Diagnostics */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleCopyDiagnostics}
              style={{
                flex: 1,
                minWidth: '140px',
                padding: '9px 12px',
                backgroundColor: copiedDiag ? '#10B981' : '#2A2E35',
                color: '#F1EFEA',
                border: 'none',
                borderRadius: 10,
                fontSize: 11.5,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'background-color 0.2s ease',
              }}
            >
              <span>{copiedDiag ? '✓' : '📋'}</span>
              <span>{copiedDiag ? 'Diagnostics Copied!' : 'Copy Diagnostics Log'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowLogs((prev) => !prev)}
              style={{
                padding: '9px 12px',
                backgroundColor: '#16191D',
                color: '#9D9C9A',
                border: '1px solid #2A2E35',
                borderRadius: 10,
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {showLogs ? 'Hide Log ▲' : `View Log (${trackingStatus.logs.length}) ▼`}
            </button>
          </div>

          {/* Diagnostic Log Drawer */}
          {showLogs && (
            <div style={{
              marginTop: 12,
              padding: '10px',
              backgroundColor: '#111316',
              border: '1px solid #2A2E35',
              borderRadius: 10,
              maxHeight: 180,
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: 10.5,
            }}>
              {trackingStatus.logs.length === 0 ? (
                <div style={{ color: '#9D9C9A', textAlign: 'center', padding: '10px 0' }}>
                  No log entries recorded yet.
                </div>
              ) : (
                trackingStatus.logs.map((item, idx) => (
                  <div key={idx} style={{ marginBottom: 4, lineHeight: 1.35, wordBreak: 'break-word' }}>
                    <span style={{ color: '#9D9C9A' }}>[{item.timestamp}] </span>
                    <span style={{
                      color: item.level === 'ERROR' ? '#EF4444' : (item.level === 'WARN' ? '#F0C23A' : '#10B981'),
                      fontWeight: 700,
                    }}>
                      [{item.level}]
                    </span>{' '}
                    <span style={{ color: '#F1EFEA' }}>{item.message}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* SECTION: Convoy Controls */}
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>SESSION CONTROLS</span>
        </div>

        <div style={styles.actionCard}>
          <button
            type="button"
            onClick={onReturnToRide}
            style={styles.primaryActionBtn}
          >
            🗺️ Return to Ride Map
          </button>

          {isCaptain && onEndRide && (
            <button
              type="button"
              onClick={onEndRide}
              style={styles.dangerActionBtn}
            >
              🏁 End Ride for Convoy
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#111316',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px 14px',
    borderBottom: '1px solid #1F2228',
    backgroundColor: '#16191D',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#1B1E23',
    border: '1.5px solid #F0C23A',
    color: '#F0C23A',
    fontWeight: 900,
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userNameTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 900,
    color: '#F1EFEA',
    letterSpacing: '-0.02em',
  },
  userSub: {
    margin: '2px 0 0',
    fontSize: 12,
    color: '#9D9C9A',
    fontWeight: 600,
  },
  backBtn: {
    padding: '7px 16px',
    backgroundColor: '#2A2E35',
    color: '#F1EFEA',
    border: 'none',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
  },
  scrollContent: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: '12px 4px 8px',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 900,
    color: '#9D9C9A',
    letterSpacing: '0.08em',
  },
  sectionBadge: {
    fontSize: 9.5,
    fontWeight: 800,
    color: '#F0C23A',
    backgroundColor: 'rgba(240, 194, 58, 0.12)',
    padding: '2px 6px',
    borderRadius: 6,
  },
  settingCard: {
    backgroundColor: '#1B1E23',
    border: '1.5px solid #2A2E35',
    borderRadius: 18,
    padding: '16px',
    marginBottom: 12,
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
  },
  settingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  settingTextWrap: {
    minWidth: 0,
    flex: 1,
  },
  settingLabelWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  settingIcon: {
    fontSize: 16,
  },
  settingTitle: {
    fontSize: 14.5,
    fontWeight: 800,
    color: '#F1EFEA',
    letterSpacing: '-0.01em',
  },
  settingSub: {
    margin: 0,
    fontSize: 11.5,
    color: '#9D9C9A',
    lineHeight: 1.4,
  },
  switchTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    padding: 0,
    transition: 'background-color 0.2s ease',
    flexShrink: 0,
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
    transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  settingFooterNote: {
    marginTop: 12,
    padding: '8px 12px',
    borderRadius: 10,
    border: '1px solid #2A2E35',
    fontSize: 10.5,
    lineHeight: 1.35,
  },
  actionCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginTop: 8,
  },
  primaryActionBtn: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#F0C23A',
    color: '#111316',
    border: 'none',
    borderRadius: 14,
    fontSize: 13.5,
    fontWeight: 900,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow: '0 4px 14px rgba(240, 194, 58, 0.25)',
  },
  dangerActionBtn: {
    width: '100%',
    padding: '13px',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    color: '#EF4444',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    borderRadius: 14,
    fontSize: 12.5,
    fontWeight: 800,
    cursor: 'pointer',
  },
};

