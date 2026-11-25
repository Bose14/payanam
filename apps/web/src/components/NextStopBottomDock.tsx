import React from 'react';
import { PinnedStopData } from './PinStopModal';
import Icon from './Icon';

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
            <p style={styles.stopSub}>{onPinNewStop ? 'Choose a waypoint so your group shares a target' : 'The captain will pin the next stop for the group'}</p>
          </div>
        </div>

        <div style={styles.btnRow}>
          {onPinNewStop && (
            <button
              type="button"
              onClick={onPinNewStop}
              style={styles.btnPrimary}
            >
              <span><Icon name="pin" /></span>
              <span>Choose stop</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenTellGroup}
            style={styles.btnSecondary}
          >
            <span><Icon name="chat" /></span>
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
    backgroundColor: 'var(--pz-surface, var(--pz-surface))',
    border: '1px solid var(--pz-line, var(--pz-line))',
    borderRadius: 16,
    margin: '4px 12px 6px',
    padding: '12px 14px',
    boxShadow: 'var(--card-shadow, 0 4px 20px rgba(0, 0, 0, 0.4))',
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
    backgroundColor: 'var(--pz-line, var(--pz-line))',
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
    color: 'var(--pz-muted, var(--pz-muted))',
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
    minHeight: 44,
    padding: '10px 16px',
    backgroundColor: 'var(--pz-accent, var(--pz-accent))',
    color: 'var(--pz-on-accent, var(--pz-bg))',
    border: 'none',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    letterSpacing: -0.2,
    boxShadow: '0 2px 8px var(--pz-warn-bg)',
    transition: 'transform 0.1s ease',
    touchAction: 'manipulation',
    marginTop: 6,
  },
  btnRow: {
    display: 'flex',
    gap: 8,
    marginTop: 6,
  },
  btnPrimary: {
    flex: 1,
    minHeight: 42,
    padding: '10px 14px',
    backgroundColor: 'var(--pz-accent, var(--pz-accent))',
    border: '1px solid var(--pz-accent, var(--pz-accent))',
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 800,
    color: 'var(--pz-on-accent, var(--pz-bg))',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    boxShadow: '0 2px 8px var(--pz-warn-bg)',
    touchAction: 'manipulation',
  },
  btnSecondary: {
    flex: 1,
    minHeight: 42,
    padding: '10px 14px',
    backgroundColor: 'var(--pz-surface, var(--pz-surface))',
    border: '1px solid var(--pz-line, var(--pz-line))',
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
};

export default NextStopBottomDock;
