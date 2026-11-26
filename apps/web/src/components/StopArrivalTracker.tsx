import React, { useState } from 'react';
import { PinnedStopData } from './PinStopModal';
import Icon from './Icon';

export interface RiderArrivalInfo {
  userId: string;
  userName: string;
  status: 'arrived' | 'en_route' | 'departed';
  arrivedAt?: string;
  distanceKm?: number | null;
  isStale?: boolean;
  ageLabel?: string;
}

interface StopArrivalTrackerProps {
  pinnedStop: PinnedStopData | null;
  ridersArrival: Record<string, RiderArrivalInfo>;
  currentUserId?: string;
  myDistanceKm?: number | null;
  mySpeedKmh?: number;
  isMyStale?: boolean;
  myAgeLabel?: string;
  onToggleMyArrival: (isArrived: boolean) => void;
  onOpenNavigation: (stop: { name: string; lat: number; lng: number }) => void;
  /** Captain only. Omit for riders. */
  onChangePin?: () => void;
  onClearPin?: () => void;
  isLeader?: boolean;
}

export default function StopArrivalTracker({
  pinnedStop,
  ridersArrival,
  currentUserId,
  myDistanceKm,
  mySpeedKmh = 0,
  isMyStale = false,
  myAgeLabel,
  onToggleMyArrival,
  onOpenNavigation,
  onChangePin,
  onClearPin,
  isLeader = false,
}: StopArrivalTrackerProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  if (!pinnedStop) return null;

  const arrivalsList = Object.values(ridersArrival);
  const totalRiders = Math.max(arrivalsList.length, 1);
  const arrivedRiders = arrivalsList.filter((r) => r.status === 'arrived');
  const myStatus = currentUserId ? ridersArrival[currentUserId]?.status : 'en_route';
  const isMeArrived = myStatus === 'arrived';

  // Calculate ETA in minutes based on real speed or default 50 km/h
  let etaMinutes: number | null = null;
  if (myDistanceKm != null && myDistanceKm > 0.05) {
    const effectiveSpeed = mySpeedKmh > 10 ? mySpeedKmh : 50;
    etaMinutes = Math.max(Math.round((myDistanceKm / effectiveSpeed) * 60), 1);
  }

  const progressPercent = Math.min(Math.round((arrivedRiders.length / totalRiders) * 100), 100);

  return (
    <div style={styles.container}>
      {/* Main Bar */}
      <div style={styles.topBar}>
        <div style={styles.stopInfo} onClick={() => setExpanded(!expanded)}>
          <div style={styles.iconBadge}>
            {pinnedStop.type === 'fuel_stop' ? <Icon name="fuel" /> :
             pinnedStop.type === 'meal' ? <Icon name="food" /> :
             pinnedStop.type === 'rest' ? <Icon name="coffee" /> :
             pinnedStop.type === 'attraction' ? <Icon name="pin" /> : <Icon name="pin" />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.stopTitleRow}>
              <span style={styles.stopName}>{pinnedStop.name}</span>
            </div>
            <div style={styles.progressRow}>
              <span style={styles.badgeETA}>
                {myDistanceKm != null && myDistanceKm < 0.2 ? (
                  'You are here!'
                ) : isMyStale ? (
                  <span style={{ color: '#f59e0b', fontWeight: 700 }}>
                    Unknown · {myAgeLabel || 'position stale'}
                  </span>
                ) : (
                  <>
                    {myDistanceKm != null ? `${myDistanceKm.toFixed(1)} km` : ''}
                    {etaMinutes != null ? ` · ~${etaMinutes}m` : ''}
                  </>
                )}
              </span>
              <span style={styles.progressText}>
                {arrivedRiders.length}/{totalRiders} arrived
              </span>
            </div>
            <div style={{ ...styles.progressBarBg, marginTop: 4 }}>
              <div style={{ ...styles.progressBarFill, width: `${progressPercent}%` }} />
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={styles.actions}>
          <button
            type="button"
            onClick={() => onToggleMyArrival(!isMeArrived)}
            style={{
              ...styles.btnArrival,
              background: isMeArrived ? '#10b981' : '#374151',
              color: '#fff',
            }}
          >
            {isMeArrived ? 'Arrived' : 'Arrived?'}
          </button>
          <button
            type="button"
            onClick={() => onOpenNavigation({ name: pinnedStop.name, lat: pinnedStop.lat, lng: pinnedStop.lng })}
            style={styles.btnNav}
            title="Open in Maps"
          >
            <Icon name="compass" />
          </button>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            style={styles.btnToggle}
            aria-label={expanded ? 'Hide rider status' : 'Show rider status'}
            aria-expanded={expanded}
          >
            <span style={{ display: 'inline-block', transform: expanded ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.15s' }}>▼</span>
          </button>
        </div>
      </div>

      {/* Expanded Details Drawer */}
      {expanded && (
        <div style={styles.expandedDrawer}>
          {(onChangePin || (isLeader && onClearPin)) && (
            <div style={styles.actionRow}>
              {onChangePin && (
                <button
                  type="button"
                  onClick={() => { setExpanded(false); setConfirmClear(false); onChangePin(); }}
                  style={styles.actionBtn}
                >
                  <Icon name="edit" /> <span>Change stop</span>
                </button>
              )}
              {isLeader && onClearPin && (
                <button
                  type="button"
                  onClick={() => {
                    if (!confirmClear) { setConfirmClear(true); return; }
                    setConfirmClear(false);
                    setExpanded(false);
                    onClearPin();
                  }}
                  style={{ ...styles.actionBtn, ...styles.actionDanger, ...(confirmClear ? styles.actionDangerOn : null) }}
                >
                  <Icon name="close" /> <span>{confirmClear ? 'Tap again to clear' : 'Clear pin'}</span>
                </button>
              )}
            </div>
          )}
          <div style={styles.drawerTitle}>Rider status at this stop</div>

          <div style={styles.ridersGrid}>
            {arrivalsList.map((r) => {
              const isArrived = r.status === 'arrived';
              return (
                <div
                  key={r.userId}
                  style={{
                    ...styles.riderChip,
                    borderColor: isArrived ? '#10b981' : '#374151',
                    background: isArrived ? 'rgba(16, 185, 129, 0.15)' : '#111827',
                  }}
                >
                  <span style={{ fontSize: 14, display: 'inline-flex', color: isArrived ? '#34d399' : '#9ca3af' }}>{isArrived ? <Icon name="check" /> : <Icon name="clock" />}</span>
                  <span style={{ fontWeight: 600, color: '#fff', fontSize: 12 }}>{r.userName}</span>
                  <span style={{ color: isArrived ? '#34d399' : (r.isStale ? '#f59e0b' : '#9ca3af'), fontSize: 11, marginLeft: 'auto' }}>
                    {isArrived
                      ? (r.arrivedAt || 'Arrived')
                      : r.isStale
                      ? `Unknown (${r.ageLabel || 'stale'})`
                      : (r.distanceKm != null ? `${r.distanceKm.toFixed(1)} km` : 'En route')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#1f2937',
    borderBottom: '1px solid #374151',
    boxShadow: '0 -4px 12px rgba(0,0,0,0.3)',
    position: 'relative',
    zIndex: 1200,
    flexShrink: 0,
  },
  topBar: {
    padding: '8px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  stopInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
    cursor: 'pointer',
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    background: '#111827',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    border: '1px solid #374151',
    flexShrink: 0,
    color: '#F0C23A',
  },
  stopTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  stopName: {
    color: '#fff',
    fontWeight: 700,
    fontSize: 13,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  badgeETA: {
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: 700,
    background: 'rgba(59, 130, 246, 0.15)',
    padding: '1px 6px',
    borderRadius: 6,
    flexShrink: 0,
  },
  progressRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  progressBarBg: {
    flex: 1,
    height: 4,
    background: '#374151',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    background: '#10b981',
    borderRadius: 2,
    transition: 'width 0.3s ease',
  },
  progressText: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: 600,
    flexShrink: 0,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  btnArrival: {
    border: 'none',
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  btnNav: {
    background: '#3b82f6',
    border: 'none',
    color: '#fff',
    borderRadius: 8,
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    cursor: 'pointer',
  },
  btnToggle: {
    background: '#111827',
    border: '1px solid #374151',
    borderRadius: 999,
    color: '#e5e7eb',
    width: 40,
    height: 40,
    fontSize: 12,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    touchAction: 'manipulation',
  },
  expandedDrawer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '100%',
    maxHeight: '45vh',
    overflowY: 'auto',
    background: '#111827',
    padding: '10px 14px 14px',
    borderTop: '1px solid #374151',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    boxShadow: '0 -8px 20px rgba(0,0,0,0.35)',
  },
  drawerHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 12,
  },
  actionBtn: {
    flex: 1,
    minHeight: 44,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    border: '1px solid #F0C23A',
    background: 'rgba(240, 194, 58, 0.12)',
    color: '#F0C23A',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    touchAction: 'manipulation',
  },
  actionDanger: {
    border: '1px solid #ef4444',
    background: 'rgba(239, 68, 68, 0.12)',
    color: '#f87171',
  },
  actionDangerOn: {
    background: '#ef4444',
    color: '#fff',
  },
  drawerTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#9ca3af',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    padding: 0,
  },
  ridersGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  riderChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid #374151',
  },
};

