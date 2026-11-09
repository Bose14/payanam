import React from 'react';
import { PinnedStopData } from './PinStopModal';

interface NextStopBottomDockProps {
  pinnedStop: PinnedStopData | null;
  distanceKm?: number | null;
  arrivedCount: number;
  totalCount: number;
  onOpenDetail: () => void;
  onOpenTellGroup: () => void;
  onPinNewStop?: () => void;
}

export const NextStopBottomDock: React.FC<NextStopBottomDockProps> = ({
  pinnedStop,
  distanceKm,
  arrivedCount,
  totalCount,
  onOpenDetail,
  onOpenTellGroup,
  onPinNewStop,
}) => {
  if (!pinnedStop) {
    return (
      <div style={styles.dock}>
        {/* Subtle grab handle */}
        <div style={styles.handleWrap} onClick={onPinNewStop}>
          <div style={styles.handle} />
        </div>

        <div style={styles.unpinnedHeader} onClick={onPinNewStop}>
          <div style={styles.iconCircle}>📌</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.unpinnedTitle}>Convoy Regroup Point</div>
            <div style={styles.unpinnedSub}>No target stop chosen · Tap to pin a stop</div>
          </div>
        </div>

        {/* Action Buttons: 2 large glove-friendly targets */}
        <div style={styles.btnRow}>
          {onPinNewStop && (
            <button
              type="button"
              onClick={onPinNewStop}
              style={styles.primaryBtn}
            >
              <span>📌 Choose Target Stop</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenTellGroup}
            style={styles.secondaryBtn}
          >
            <span>⚡ Tell group</span>
          </button>
        </div>
      </div>
    );
  }

  // Type Icon helper
  const stopIcon = pinnedStop.type === 'fuel_stop' ? '⛽' :
                   pinnedStop.type === 'meal' ? '🍽️' :
                   pinnedStop.type === 'rest' ? '☕' :
                   pinnedStop.type === 'attraction' ? '📍' : '📌';

  return (
    <div style={styles.dock}>
      {/* Top Handle bar for tactile dragging feel */}
      <div style={styles.handleWrap} onClick={onOpenDetail}>
        <div style={styles.handle} />
      </div>

      <div style={styles.contentRow} onClick={onOpenDetail} title="Tap to inspect stop telemetry & ETAs">
        <div style={styles.iconCirclePinned}>{stopIcon}</div>

        {/* Left Side: Stop Name + Distance + Arrival count */}
        <div style={styles.infoArea}>
          <div style={styles.nameRow}>
            <span style={styles.stopName}>{pinnedStop.name}</span>
            <span style={styles.arrivedRatio}>
              {arrivedCount} of {Math.max(totalCount, 1)} here
            </span>
          </div>
          <div style={styles.subRow}>
            <span style={styles.subText}>
              Next stop{distanceKm != null ? ` · ${distanceKm.toFixed(1)} km` : ''}
            </span>
            <span style={styles.tapTip}>Tap for ETAs ›</span>
          </div>
        </div>
      </div>

      {/* Prominent Glove-Friendly Button */}
      <div style={{ marginTop: 10 }}>
        <button
          type="button"
          onClick={onOpenTellGroup}
          style={styles.tellGroupLargeBtn}
        >
          <span>⚡ Tell group</span>
          <span style={styles.tellGroupSubtext}>Send quick status · Glove friendly</span>
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  dock: {
    backgroundColor: '#1e293b',
    borderTop: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '24px 24px 0 0',
    padding: '8px 16px 14px',
    boxShadow: '0 -8px 25px rgba(0, 0, 0, 0.55)',
    zIndex: 800,
    flexShrink: 0,
    color: '#ffffff',
  },
  handleWrap: {
    display: 'flex',
    justifyContent: 'center',
    padding: '2px 0 8px',
    cursor: 'pointer',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#64748b',
  },
  unpinnedHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    cursor: 'pointer',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    flexShrink: 0,
  },
  iconCirclePinned: {
    width: 42,
    height: 42,
    borderRadius: '50%',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    border: '1.5px solid #f59e0b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    flexShrink: 0,
  },
  unpinnedTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  unpinnedSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 1,
  },
  btnRow: {
    display: 'flex',
    gap: 10,
  },
  primaryBtn: {
    flex: 1.4,
    padding: '12px 14px',
    backgroundColor: '#f59e0b',
    color: '#0f172a',
    border: 'none',
    borderRadius: 14,
    fontWeight: 900,
    fontSize: 13,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)',
  },
  secondaryBtn: {
    flex: 1,
    padding: '12px 12px',
    backgroundColor: '#334155',
    color: '#ffffff',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: 14,
    fontWeight: 800,
    fontSize: 13,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  contentRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    cursor: 'pointer',
  },
  infoArea: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  stopName: {
    fontSize: 16,
    fontWeight: 900,
    color: '#ffffff',
    letterSpacing: -0.3,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  arrivedRatio: {
    fontSize: 11,
    fontWeight: 800,
    color: '#34d399',
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    padding: '2px 8px',
    borderRadius: 999,
    border: '1px solid rgba(52, 211, 153, 0.3)',
    whiteSpace: 'nowrap',
  },
  subRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  subText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: 600,
  },
  tapTip: {
    fontSize: 11,
    color: '#f59e0b',
    fontWeight: 700,
  },
  tellGroupLargeBtn: {
    width: '100%',
    padding: '13px 18px',
    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    color: '#0f172a',
    border: 'none',
    borderRadius: 14,
    fontWeight: 900,
    fontSize: 15,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow: '0 4px 15px rgba(245, 158, 11, 0.35)',
    transition: 'transform 0.1s ease',
  },
  tellGroupSubtext: {
    fontSize: 11,
    fontWeight: 700,
    color: 'rgba(15, 23, 42, 0.75)',
    marginLeft: 4,
  },
};

export default NextStopBottomDock;
