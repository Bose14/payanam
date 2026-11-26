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
}) => {
  // With no target stop the captain uses the add-stop button on the map; nothing is shown here.
  if (!pinnedStop) return null;

  const meta = [
    'Next stop',
    distanceKm != null ? `${distanceKm.toFixed(1)} km` : null,
    `${arrivedCount}/${Math.max(totalCount, 1)} here`,
  ].filter(Boolean).join(' · ');

  return (
    <div style={styles.dockCard}>
      <button type="button" onClick={onOpenDetail} style={styles.mainBtn} aria-label={`Next stop ${pinnedStop.name}. Open details`}>
        <span style={styles.badge}><Icon name="pin" /></span>
        <span style={styles.textCol}>
          <span style={styles.stopName}>{pinnedStop.name}</span>
          <span style={styles.stopSub}>{meta}</span>
        </span>
      </button>
      <button type="button" onClick={onOpenTellGroup} style={styles.iconBtn} aria-label="Tell group" title="Tell group">
        <Icon name="megaphone" />
      </button>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  dockCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'var(--pz-surface)',
    border: '1px solid var(--pz-line)',
    borderRadius: 16,
    margin: '4px 12px 6px',
    padding: '8px 8px 8px 10px',
    boxShadow: 'var(--card-shadow, 0 4px 20px rgba(0, 0, 0, 0.25))',
    flexShrink: 0,
    zIndex: 800,
    boxSizing: 'border-box',
    minWidth: 0,
  },
  mainBtn: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'none',
    border: 'none',
    padding: 0,
    textAlign: 'left',
    cursor: 'pointer',
    touchAction: 'manipulation',
    color: 'var(--pz-ink)',
    font: 'inherit',
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    backgroundColor: 'var(--pz-warn-bg)',
    color: 'var(--pz-accent)',
  },
  textCol: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    flex: 1,
  },
  stopName: {
    fontSize: 15,
    fontWeight: 800,
    color: 'var(--pz-ink)',
    letterSpacing: -0.2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  stopSub: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--pz-muted)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  iconBtn: {
    width: 44,
    height: 44,
    flexShrink: 0,
    borderRadius: 999,
    border: 'none',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    backgroundColor: 'var(--pz-accent)',
    color: 'var(--pz-on-accent)',
    touchAction: 'manipulation',
  },
};

export default NextStopBottomDock;
