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
      <div style={styles.dockEmpty}>
        <div style={{ flex: 1 }}>
          <p style={styles.emptyTitle}>No stop pinned for convoy</p>
          <span style={styles.emptySub}>Pin a planned or custom stop so riders have a shared target</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {onPinNewStop && (
            <button
              type="button"
              onClick={onPinNewStop}
              style={styles.pinBtn}
            >
              📌 Pin Stop
            </button>
          )}
          <button
            type="button"
            onClick={onOpenTellGroup}
            style={styles.tellGroupBtn}
          >
            Tell group
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.dock}>
      {/* Top Handle bar */}
      <div style={styles.handleWrap} onClick={onOpenDetail}>
        <div style={styles.handle} />
      </div>

      <div style={styles.contentRow}>
        {/* Left Side: Stop Name + Distance + Arrival count */}
        <div style={styles.infoArea} onClick={onOpenDetail} title="Tap to view stop details and ETAs">
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

        {/* Right Side: Tell Group Button */}
        <button
          type="button"
          onClick={onOpenTellGroup}
          style={styles.tellGroupBtn}
        >
          Tell group
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  dock: {
    backgroundColor: 'var(--bg-card, #111827)',
    borderTop: '1.5px solid var(--border-card, #374151)',
    borderRadius: '20px 20px 0 0',
    padding: '8px 16px 14px',
    boxShadow: '0 -6px 20px rgba(0, 0, 0, 0.45)',
    zIndex: 800,
    flexShrink: 0,
  },
  dockEmpty: {
    backgroundColor: 'var(--bg-card, #111827)',
    borderTop: '1px solid var(--border-card, #374151)',
    borderRadius: '18px 18px 0 0',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    zIndex: 800,
    flexShrink: 0,
  },
  handleWrap: {
    display: 'flex',
    justifyContent: 'center',
    padding: '2px 0 8px',
    cursor: 'pointer',
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#4b5563',
  },
  contentRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  infoArea: {
    flex: 1,
    minWidth: 0,
    cursor: 'pointer',
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
    color: 'var(--text-primary, #ffffff)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  arrivedRatio: {
    fontSize: 12,
    fontWeight: 700,
    color: '#34d399',
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
    color: 'var(--text-secondary, #9ca3af)',
    fontWeight: 500,
  },
  tapTip: {
    fontSize: 11,
    color: 'var(--accent-gold, #f59e0b)',
    fontWeight: 700,
  },
  tellGroupBtn: {
    padding: '12px 18px',
    borderRadius: 14,
    backgroundColor: 'var(--accent-gold, #f59e0b)',
    color: '#000000',
    border: 'none',
    fontWeight: 900,
    fontSize: 14,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    boxShadow: '0 3px 10px rgba(245, 158, 11, 0.3)',
    flexShrink: 0,
  },
  pinBtn: {
    padding: '10px 14px',
    borderRadius: 12,
    backgroundColor: '#1f2937',
    color: '#ffffff',
    border: '1px solid #4b5563',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  },
  emptyTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 700,
    color: '#ffffff',
  },
  emptySub: {
    fontSize: 11,
    color: '#9ca3af',
  },
};

export default NextStopBottomDock;

