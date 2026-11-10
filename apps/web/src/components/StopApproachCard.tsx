import React from 'react';
import { PinnedStopData } from './PinStopModal';
import { StopApproachStage } from '../utils/stopPinning';

export interface StopApproachCardProps {
  pinnedStop: PinnedStopData | null;
  stage: StopApproachStage;
  distanceKm?: number | null;
  etaFormatted: string;
  arrivedCount: number;
  totalCount: number;
  isMeArrived: boolean;
  onToggleMyArrival: (arrived: boolean) => void;
  onOpenDetail: () => void;
  onOpenNavigation?: (stop: { name: string; lat: number; lng: number }) => void;
  onDismiss?: () => void;
}

export const StopApproachCard: React.FC<StopApproachCardProps> = ({
  pinnedStop,
  stage,
  distanceKm,
  etaFormatted,
  arrivedCount,
  totalCount,
  isMeArrived,
  onToggleMyArrival,
  onOpenDetail,
  onOpenNavigation,
  onDismiss,
}) => {
  if (!pinnedStop || stage === 'far') return null;

  const isArrivedStage = stage === 'arrived' || isMeArrived;
  const stopTypeIcon = pinnedStop.type === 'fuel_stop' ? '⛽' :
                       pinnedStop.type === 'meal' ? '🍽️' :
                       pinnedStop.type === 'rest' ? '☕' : '📍';

  return (
    <div style={{
      ...styles.container,
      borderColor: isArrivedStage ? '#10B981' : '#F0C23A',
      background: isArrivedStage ? 'rgba(16, 185, 129, 0.08)' : 'rgba(27, 30, 35, 0.98)',
    }}>
      {/* Top Header Row */}
      <div style={styles.headerRow}>
        <div style={styles.headerLeft}>
          <span style={styles.iconCircle}>{stopTypeIcon}</span>
          <div>
            <div style={styles.pretitle}>
              {isArrivedStage ? 'STOP REACHED' : 'PRE-ALERT · NEXT STOP'}
            </div>
            <h3 style={styles.stopName}>{pinnedStop.name}</h3>
          </div>
        </div>

        <div style={styles.headerRight}>
          <span style={{
            ...styles.stageBadge,
            color: isArrivedStage ? '#10B981' : '#F0C23A',
            borderColor: isArrivedStage ? '#10B981' : '#F0C23A',
            backgroundColor: isArrivedStage ? 'rgba(16, 185, 129, 0.15)' : 'rgba(240, 194, 58, 0.15)',
          }}>
            {isArrivedStage ? 'HERE' : 'APPROACHING'}
          </span>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              style={styles.closeBtn}
              title="Dismiss banner"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Info Content Row */}
      <div style={styles.contentRow}>
        <div style={styles.etaBlock}>
          <span style={styles.etaText}>
            {isArrivedStage ? 'Group Regrouping' : etaFormatted}
          </span>
          <span style={styles.distSub}>
            {isArrivedStage
              ? `${arrivedCount} of ${Math.max(totalCount, 1)} riders arrived`
              : `${distanceKm != null ? `${distanceKm.toFixed(1)} km away · ` : ''}Prepare to regroup`}
          </span>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div style={styles.btnRow}>
        <button
          type="button"
          onClick={() => onToggleMyArrival(!isMeArrived)}
          style={{
            ...styles.primaryBtn,
            backgroundColor: isMeArrived ? '#10B981' : '#F0C23A',
            color: '#111316',
          }}
        >
          {isMeArrived ? '✓ You are here' : "I'm here"}
        </button>

        <button
          type="button"
          onClick={onOpenDetail}
          style={styles.secondaryBtn}
        >
          Stop details ›
        </button>

        {onOpenNavigation && (
          <button
            type="button"
            onClick={() => onOpenNavigation({ name: pinnedStop.name, lat: pinnedStop.lat, lng: pinnedStop.lng })}
            style={styles.iconNavBtn}
            title="Open in Maps"
          >
            🧭
          </button>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    margin: '0 16px 8px 16px',
    padding: '12px 14px',
    borderRadius: 18,
    border: '1.5px solid #F0C23A',
    backgroundColor: '#1B1E23',
    boxShadow: '0 4px 18px rgba(0, 0, 0, 0.4)',
    flexShrink: 0,
    zIndex: 30,
    transition: 'all 0.25s ease',
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
    gap: 10,
    minWidth: 0,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#111316',
    border: '1px solid #2A2E35',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 15,
    flexShrink: 0,
  },
  pretitle: {
    fontSize: 9,
    fontWeight: 900,
    color: '#9D9C9A',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  stopName: {
    margin: '1px 0 0',
    fontSize: 14,
    fontWeight: 900,
    color: '#F1EFEA',
    letterSpacing: -0.2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  stageBadge: {
    fontSize: 9.5,
    fontWeight: 900,
    letterSpacing: 0.6,
    padding: '2px 8px',
    borderRadius: 999,
    border: '1.5px solid',
    textTransform: 'uppercase',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#9D9C9A',
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    padding: '2px 4px',
  },
  contentRow: {
    margin: '8px 0 10px',
  },
  etaBlock: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
  },
  etaText: {
    fontSize: 13,
    fontWeight: 800,
    color: '#F1EFEA',
  },
  distSub: {
    fontSize: 11,
    color: '#9D9C9A',
    fontWeight: 600,
  },
  btnRow: {
    display: 'flex',
    gap: 8,
  },
  primaryBtn: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: 10,
    border: 'none',
    fontWeight: 900,
    fontSize: 12,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  secondaryBtn: {
    padding: '8px 14px',
    borderRadius: 10,
    backgroundColor: '#111316',
    border: '1px solid #2A2E35',
    color: '#F1EFEA',
    fontWeight: 800,
    fontSize: 12,
    cursor: 'pointer',
  },
  iconNavBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#111316',
    border: '1px solid #2A2E35',
    color: '#F1EFEA',
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
};
