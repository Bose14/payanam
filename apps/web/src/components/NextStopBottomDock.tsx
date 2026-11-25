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
      <div style={styles.dockCard}>
        <div style={styles.unpinnedInfo} onClick={onPinNewStop}>
          <div>
            <h4 style={styles.stopName}>No target stop pinned</h4>
            <p style={styles.stopSub}>Choose a waypoint so your group shares a target</p>
          </div>
        </div>

        <div style={styles.btnRow}>
          {onPinNewStop && (
            <button
              type="button"
              onClick={onPinNewStop}
              style={styles.btnWhite}
            >
              <span>📌</span>
              <span>Choose stop</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenTellGroup}
            style={styles.btnYellow}
          >
            <span>💬</span>
            <span>Tell group</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.dockCard}>
      {/* Top drag notch */}
      <div style={styles.notchWrap} onClick={onOpenDetail}>
        <div style={styles.notch} />
      </div>

      {/* Main Info Row (Mockup 1 Signature) */}
      <div style={styles.infoRow} onClick={onOpenDetail}>
        <div>
          <h4 style={styles.stopName}>{pinnedStop.name}</h4>
          <p style={styles.stopSub}>
            Next stop{distanceKm != null ? ` · ${distanceKm.toFixed(1)} km` : ''}
          </p>
        </div>
        <div style={styles.arrivalRatio}>
          {arrivedCount} of {Math.max(totalCount, 1)} here
        </div>
      </div>

      {/* Full-Width Signature Mustard Yellow Button */}
      <button
        type="button"
        onClick={onOpenTellGroup}
        style={styles.tellGroupBtn}
      >
        Tell group
      </button>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  dockCard: {
    backgroundColor: '#1B1E23',
    border: '1.5px solid #2A2E35',
    borderRadius: 18,
    margin: '4px 12px 6px',
    padding: '10px 14px 12px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
    flexShrink: 0,
    zIndex: 800,
    boxSizing: 'border-box',
  },
  notchWrap: {
    display: 'flex',
    justifyContent: 'center',
    paddingBottom: 6,
    cursor: 'pointer',
  },
  notch: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3A3F47',
  },
  infoRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    cursor: 'pointer',
    marginBottom: 8,
  },
  unpinnedInfo: {
    marginBottom: 8,
    cursor: 'pointer',
  },
  stopName: {
    margin: 0,
    fontSize: 15,
    fontWeight: 900,
    color: 'var(--text-primary)',
    letterSpacing: -0.3,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  stopSub: {
    margin: '2px 0 0',
    fontSize: 12,
    fontWeight: 600,
    color: '#9D9C9A',
  },
  arrivalRatio: {
    fontSize: 13,
    fontWeight: 800,
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    paddingTop: 1,
  },
  tellGroupBtn: {
    width: '100%',
    minHeight: 46,
    padding: '12px 16px',
    backgroundColor: '#F0C23A',
    color: '#111316',
    border: 'none',
    borderRadius: 14,
    fontSize: 15,
    fontWeight: 900,
    cursor: 'pointer',
    letterSpacing: -0.2,
    boxShadow: '0 3px 12px rgba(240, 194, 58, 0.25)',
    transition: 'transform 0.1s ease',
    touchAction: 'manipulation',
    marginTop: 6,
  },
  btnRow: {
    display: 'flex',
    gap: 8,
    marginTop: 6,
  },
  btnWhite: {
    flex: 1,
    minHeight: 44,
    padding: '10px 12px',
    backgroundColor: '#1B1E23',
    border: '1.5px solid #2A2E35',
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 800,
    color: 'var(--text-primary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    touchAction: 'manipulation',
  },
  btnYellow: {
    flex: 1,
    minHeight: 44,
    padding: '10px 12px',
    backgroundColor: '#F0C23A',
    border: 'none',
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 900,
    color: '#111316',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    boxShadow: '0 2px 8px rgba(240, 194, 58, 0.25)',
    touchAction: 'manipulation',
  },
};

export default NextStopBottomDock;
