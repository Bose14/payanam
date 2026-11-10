import React, { useState } from 'react';
import { RiderRouteStatus } from '../utils/plannedRouteProgress';

export interface RouteProgressRider {
  userId: string;
  userName: string;
  isMe?: boolean;
  isCaptain?: boolean;
  color: string;
  progressPercent: number;
  distanceAlongMeters: number;
  routeStatus: RiderRouteStatus;
}

export interface RouteMilestoneStop {
  id: string;
  place: string;
  progressPercent: number;
  itemType?: string;
}

export interface RouteProgressStripProps {
  routeTitle: string;
  totalDistanceMeters: number;
  riders: RouteProgressRider[];
  stops: RouteMilestoneStop[];
  onSelectRider?: (userId: string) => void;
  onSelectStop?: (stopId: string) => void;
}

export const RouteProgressStrip: React.FC<RouteProgressStripProps> = ({
  routeTitle,
  totalDistanceMeters,
  riders,
  stops,
  onSelectRider,
  onSelectStop,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const totalKm = (totalDistanceMeters / 1000).toFixed(0);

  // Group status counts
  const aheadCount = riders.filter((r) => r.routeStatus.status === 'ahead').length;
  const onPlanCount = riders.filter((r) => r.routeStatus.status === 'on_plan').length;
  const behindCount = riders.filter((r) => r.routeStatus.status === 'behind').length;
  const offRouteCount = riders.filter((r) => r.routeStatus.status === 'off_route').length;

  return (
    <div style={styles.container}>
      {/* Top Header Row */}
      <div style={styles.headerRow}>
        <div style={styles.headerLeft}>
          <span style={styles.routeIcon}>🛣️</span>
          <span style={styles.routeTitle}>{routeTitle || 'Planned Route Progress'}</span>
          <span style={styles.routeKm}>{totalKm} km</span>
        </div>

        <div style={styles.headerRight}>
          {offRouteCount > 0 && (
            <span style={styles.offRouteTag}>
              ⚠️ {offRouteCount} off route
            </span>
          )}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            style={styles.toggleBtn}
            title={collapsed ? 'Expand Route Track' : 'Collapse Route Track'}
          >
            {collapsed ? '▾ Track' : '▴ Hide'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Linear Route Progress Line Track */}
          <div style={styles.trackWrapper}>
            {/* Background Route Rail */}
            <div style={styles.rail}>
              {/* Mustard yellow planned route fill */}
              <div style={styles.railFill} />
            </div>

            {/* Intermediate Stops (Milestones) along the line */}
            {stops.map((stop) => {
              const leftPercent = Math.max(3, Math.min(97, stop.progressPercent));
              return (
                <div
                  key={`stop-${stop.id}`}
                  onClick={() => onSelectStop?.(stop.id)}
                  style={{
                    ...styles.stopMilestone,
                    left: `${leftPercent}%`,
                  }}
                  title={`Stop: ${stop.place}`}
                >
                  <div style={styles.stopIconDisc}>
                    {stop.itemType === 'fuel' ? '⛽' : stop.itemType === 'food' ? '🍲' : '⭐'}
                  </div>
                  <span style={styles.stopLabel}>{stop.place.slice(0, 10)}</span>
                </div>
              );
            })}

            {/* Riders placed along the line by progress */}
            {riders.map((r) => {
              const leftPercent = Math.max(4, Math.min(96, r.progressPercent));
              const { status, badgeTextColor, shape } = r.routeStatus;

              let borderRadius = '50%';
              if (shape === 'square') borderRadius = '6px';
              if (shape === 'chevron') borderRadius = '4px 12px 4px 12px';
              if (shape === 'octagon') borderRadius = '8px';

              return (
                <div
                  key={`progress-rider-${r.userId}`}
                  onClick={() => onSelectRider?.(r.userId)}
                  style={{
                    ...styles.riderMarkerWrap,
                    left: `${leftPercent}%`,
                  }}
                  title={`${r.userName} (${r.routeStatus.label}): ${(r.distanceAlongMeters / 1000).toFixed(1)} km`}
                >
                  {/* Avatar Pip */}
                  <div
                    style={{
                      ...styles.riderPip,
                      backgroundColor: status === 'unknown' ? '#1B1E23' : badgeTextColor,
                      borderColor: status === 'unknown' ? '#4B5563' : '#111316',
                      borderRadius,
                      boxShadow: `0 2px 8px ${badgeTextColor}66`,
                    }}
                  >
                    <span style={{
                      color: status === 'unknown' ? '#9D9C9A' : '#111316',
                      fontSize: 10,
                      fontWeight: 900,
                    }}>
                      {(r.userName || '?')[0].toUpperCase()}
                    </span>
                  </div>

                  {/* Tiny Status Indicator Tag */}
                  <div style={{
                    ...styles.riderLabelTag,
                    color: badgeTextColor,
                    borderColor: badgeTextColor,
                  }}>
                    {r.routeStatus.label === 'ON PLAN' ? 'PLAN' : r.routeStatus.label}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Convoy Progress Summary Pill Row */}
          <div style={styles.summaryRow}>
            <div style={styles.summaryItem}>
              <span style={{ ...styles.statusDot, backgroundColor: '#10B981' }} />
              <span style={styles.summaryText}>{onPlanCount} on plan</span>
            </div>
            {aheadCount > 0 && (
              <div style={styles.summaryItem}>
                <span style={{ ...styles.statusDot, backgroundColor: '#38BDF8' }} />
                <span style={styles.summaryText}>{aheadCount} ahead</span>
              </div>
            )}
            {behindCount > 0 && (
              <div style={styles.summaryItem}>
                <span style={{ ...styles.statusDot, backgroundColor: '#F59E0B' }} />
                <span style={styles.summaryText}>{behindCount} behind</span>
              </div>
            )}
            {offRouteCount > 0 && (
              <div style={styles.summaryItem}>
                <span style={{ ...styles.statusDot, backgroundColor: '#EF4444' }} />
                <span style={{ ...styles.summaryText, color: '#EF4444' }}>{offRouteCount} off route</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#1B1E23',
    border: '1.5px solid #2A2E35',
    borderRadius: 16,
    margin: '0 16px 8px 16px',
    padding: '10px 14px',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
    flexShrink: 0,
    zIndex: 20,
    userSelect: 'none',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  routeIcon: {
    fontSize: 14,
  },
  routeTitle: {
    fontSize: 12,
    fontWeight: 900,
    color: '#F1EFEA',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    letterSpacing: -0.2,
  },
  routeKm: {
    fontSize: 10,
    fontWeight: 800,
    color: '#9D9C9A',
    backgroundColor: '#111316',
    border: '1px solid #2A2E35',
    padding: '1px 6px',
    borderRadius: 999,
    flexShrink: 0,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  offRouteTag: {
    fontSize: 10,
    fontWeight: 900,
    color: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid #EF4444',
    padding: '2px 6px',
    borderRadius: 999,
  },
  toggleBtn: {
    background: 'none',
    border: 'none',
    color: '#9D9C9A',
    fontSize: 11,
    fontWeight: 800,
    cursor: 'pointer',
    padding: '2px 4px',
  },
  trackWrapper: {
    position: 'relative',
    height: 52,
    margin: '8px 4px 4px',
    display: 'flex',
    alignItems: 'center',
  },
  rail: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: '#111316',
    borderRadius: 999,
    border: '1px solid #2A2E35',
    overflow: 'hidden',
  },
  railFill: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F0C23A',
    opacity: 0.85,
    backgroundImage: 'repeating-linear-gradient(90deg, #F0C23A, #F0C23A 8px, #1B1E23 8px, #1B1E23 14px)',
  },
  stopMilestone: {
    position: 'absolute',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    cursor: 'pointer',
    zIndex: 5,
  },
  stopIconDisc: {
    width: 16,
    height: 16,
    borderRadius: '50%',
    backgroundColor: '#1B1E23',
    border: '1.5px solid #F0C23A',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 8,
    boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
  },
  stopLabel: {
    fontSize: 8.5,
    fontWeight: 700,
    color: '#9D9C9A',
    marginTop: 2,
    whiteSpace: 'nowrap',
  },
  riderMarkerWrap: {
    position: 'absolute',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    cursor: 'pointer',
    zIndex: 10,
    transition: 'left 0.4s ease-out',
  },
  riderPip: {
    width: 22,
    height: 22,
    border: '2px solid #111316',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderLabelTag: {
    fontSize: 7.5,
    fontWeight: 900,
    backgroundColor: '#1B1E23',
    border: '1px solid',
    borderRadius: 999,
    padding: '0.5px 4px',
    marginTop: 2,
    whiteSpace: 'nowrap',
    letterSpacing: 0.2,
  },
  summaryRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
    paddingTop: 4,
    borderTop: '1px solid #22262E',
  },
  summaryItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
  },
  summaryText: {
    fontSize: 10,
    fontWeight: 700,
    color: '#9D9C9A',
  },
};
