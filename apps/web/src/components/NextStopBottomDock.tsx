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
              📌 Choose stop
            </button>
          )}
          <button
            type="button"
            onClick={onOpenTellGroup}
            style={styles.btnYellow}
          >
            Tell group
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
    backgroundColor: '#FFFFFF',
    border: '1.5px solid #E2DED6',
    borderRadius: 20,
    margin: '6px 14px 10px',
    padding: '12px 16px 14px',
    boxShadow: '0 4px 18px rgba(28, 25, 23, 0.08)',
    flexShrink: 0,
    zIndex: 800,
  },
  notchWrap: {
    display: 'flex',
    justifyContent: 'center',
    paddingBottom: 8,
    cursor: 'pointer',
  },
  notch: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D6D3D1',
  },
  infoRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    cursor: 'pointer',
    marginBottom: 10,
  },
  unpinnedInfo: {
    marginBottom: 10,
    cursor: 'pointer',
  },
  stopName: {
    margin: 0,
    fontSize: 16,
    fontWeight: 900,
    color: '#1C1917',
    letterSpacing: -0.3,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  stopSub: {
    margin: '2px 0 0',
    fontSize: 12,
    fontWeight: 600,
    color: '#78716C',
  },
  arrivalRatio: {
    fontSize: 13,
    fontWeight: 800,
    color: '#1C1917',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    paddingTop: 1,
  },
  tellGroupBtn: {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: '#E5A900',
    color: '#1C1917',
    border: 'none',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 900,
    cursor: 'pointer',
    letterSpacing: -0.2,
    boxShadow: '0 2px 8px rgba(229, 169, 0, 0.35)',
    transition: 'transform 0.1s ease',
  },
  btnRow: {
    display: 'flex',
    gap: 10,
  },
  btnWhite: {
    flex: 1,
    padding: '11px 14px',
    backgroundColor: '#FFFFFF',
    border: '1.5px solid #E2DED6',
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 800,
    color: '#1C1917',
    cursor: 'pointer',
  },
  btnYellow: {
    flex: 1,
    padding: '11px 14px',
    backgroundColor: '#E5A900',
    border: 'none',
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 900,
    color: '#1C1917',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(229, 169, 0, 0.35)',
  },
};

export default NextStopBottomDock;
