import React, { useState } from 'react';
import { PinnedStopData } from './PinStopModal';

export interface RiderArrivalInfo {
  userId: string;
  userName: string;
  status: 'arrived' | 'en_route' | 'departed';
  arrivedAt?: string;
  distanceKm?: number | null;
}

interface StopArrivalTrackerProps {
  pinnedStop: PinnedStopData | null;
  ridersArrival: Record<string, RiderArrivalInfo>;
  currentUserId?: string;
  myDistanceKm?: number | null;
  mySpeedKmh?: number;
  onToggleMyArrival: (isArrived: boolean) => void;
  onOpenNavigation: (stop: { name: string; lat: number; lng: number }) => void;
  onChangePin: () => void;
  onClearPin?: () => void;
  isLeader?: boolean;
}

export default function StopArrivalTracker({
  pinnedStop,
  ridersArrival,
  currentUserId,
  myDistanceKm,
  mySpeedKmh = 0,
  onToggleMyArrival,
  onOpenNavigation,
  onChangePin,
  onClearPin,
  isLeader = false,
}: StopArrivalTrackerProps) {
  const [expanded, setExpanded] = useState(false);

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
            {pinnedStop.type === 'fuel_stop' ? '⛽' :
             pinnedStop.type === 'meal' ? '🍽️' :
             pinnedStop.type === 'rest' ? '☕' :
             pinnedStop.type === 'attraction' ? '📍' : '📌'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.stopTitleRow}>
              <span style={styles.stopName}>{pinnedStop.name}</span>
              <span style={styles.badgeETA}>
                {myDistanceKm != null && myDistanceKm < 0.2 ? (
                  '🎯 You are here!'
                ) : (
                  <>
                    {myDistanceKm != null ? `${myDistanceKm.toFixed(1)} km` : ''}
                    {etaMinutes != null ? ` · ~${etaMinutes}m` : ''}
                  </>
                )}
              </span>
            </div>
            <div style={styles.progressRow}>
              <div style={styles.progressBarBg}>
                <div style={{ ...styles.progressBarFill, width: `${progressPercent}%` }} />
              </div>
              <span style={styles.progressText}>
                🏁 {arrivedRiders.length}/{totalRiders} arrived
              </span>
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
            {isMeArrived ? '✓ Arrived' : '🏁 Arrived?'}
          </button>
          <button
            type="button"
            onClick={() => onOpenNavigation({ name: pinnedStop.name, lat: pinnedStop.lat, lng: pinnedStop.lng })}
            style={styles.btnNav}
            title="Open in Maps"
          >
            🧭
          </button>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            style={styles.btnToggle}
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Expanded Details Drawer */}
      {expanded && (
        <div style={styles.expandedDrawer}>
          <div style={styles.drawerHeader}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af' }}>
              Rider Status at this Stop:
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={onChangePin}
                style={styles.linkBtn}
              >
                Change Stop
              </button>
              {isLeader && onClearPin && (
                <button
                  type="button"
                  onClick={onClearPin}
                  style={{ ...styles.linkBtn, color: '#ef4444' }}
                >
                  Clear Pin
                </button>
              )}
            </div>
          </div>

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
                  <span style={{ fontSize: 13 }}>{isArrived ? '✓' : '⏳'}</span>
                  <span style={{ fontWeight: 600, color: '#fff', fontSize: 12 }}>{r.userName}</span>
                  <span style={{ color: isArrived ? '#34d399' : '#9ca3af', fontSize: 11, marginLeft: 'auto' }}>
                    {isArrived ? (r.arrivedAt || 'Arrived') : (r.distanceKm != null ? `${r.distanceKm.toFixed(1)} km` : 'En route')}
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
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    zIndex: 900,
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
    background: 'none',
    border: 'none',
    color: '#9ca3af',
    padding: '4px',
    fontSize: 10,
    cursor: 'pointer',
  },
  expandedDrawer: {
    background: '#111827',
    padding: '10px 14px 14px',
    borderTop: '1px solid #374151',
  },
  drawerHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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

