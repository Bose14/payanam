import React from 'react';
import { PinnedStopData } from './PinStopModal';
import Icon from './Icon';

interface NextStopBottomDockProps {
  pinnedStop: PinnedStopData | null;
  distanceKm?: number | null;
  mySpeedKmh?: number;
  isMyStale?: boolean;
  myAgeLabel?: string;
  arrivedCount: number;
  totalCount: number;
  isMeArrived: boolean;
  onToggleMyArrival: (isArrived: boolean) => void;
  onOpenNavigation: () => void;
  onOpenDetail: () => void;
  onOpenTellGroup: () => void;
  /** Captain only */
  onChangeStop?: () => void;
  onPinNewStop?: () => void;
}

export const NextStopBottomDock: React.FC<NextStopBottomDockProps> = ({
  pinnedStop,
  distanceKm,
  mySpeedKmh = 0,
  isMyStale = false,
  myAgeLabel,
  arrivedCount,
  totalCount,
  isMeArrived,
  onToggleMyArrival,
  onOpenNavigation,
  onOpenDetail,
  onOpenTellGroup,
  onChangeStop,
}) => {
  // With no target stop the captain uses the add-stop button on the map; nothing is shown here.
  if (!pinnedStop) return null;

  let away: string;
  if (isMyStale) {
    away = `Position unknown${myAgeLabel ? ` (${myAgeLabel})` : ''}`;
  } else if (distanceKm != null && distanceKm < 0.2) {
    away = 'You are here';
  } else if (distanceKm != null) {
    const speed = mySpeedKmh > 10 ? mySpeedKmh : 50;
    const mins = Math.max(Math.round((distanceKm / speed) * 60), 1);
    away = `${distanceKm.toFixed(1)} km · ~${mins} min`;
  } else {
    away = 'Distance unknown';
  }

  return (
    <div style={styles.dockCard}>
      <button type="button" onClick={onOpenDetail} style={styles.mainBtn} aria-label={`Next stop ${pinnedStop.name}. Open rider status`}>
        <span style={styles.badge}><Icon name="pin" /></span>
        <span style={styles.textCol}>
          <span style={styles.label}>NEXT STOP</span>
          <span style={styles.stopName}>{pinnedStop.name}</span>
          <span style={styles.stopSub}>{away} · {arrivedCount}/{Math.max(totalCount, 1)} here</span>
        </span>
        <span style={styles.chev} aria-hidden="true">›</span>
      </button>

      <div style={styles.actions}>
        <button
          type="button"
          onClick={() => onToggleMyArrival(!isMeArrived)}
          style={{ ...styles.arrivedBtn, ...(isMeArrived ? styles.arrivedOn : null) }}
        >
          {isMeArrived ? <><Icon name="check" /> <span>I'm here</span></> : <span>I've arrived</span>}
        </button>
        <button type="button" onClick={onOpenNavigation} style={styles.iconBtn} aria-label="Navigate to stop" title="Navigate">
          <Icon name="compass" />
        </button>
        <button type="button" onClick={onOpenTellGroup} style={styles.iconBtn} aria-label="Tell group" title="Tell group">
          <Icon name="megaphone" />
        </button>
        {onChangeStop && (
          <button type="button" onClick={onChangeStop} style={styles.iconBtn} aria-label="Change stop" title="Change stop">
            <Icon name="edit" />
          </button>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  dockCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    backgroundColor: 'var(--pz-surface)',
    border: '1px solid var(--pz-line)',
    borderRadius: 16,
    margin: '4px 12px 6px',
    padding: 12,
    boxShadow: 'var(--card-shadow, 0 4px 20px rgba(0, 0, 0, 0.25))',
    flexShrink: 0,
    zIndex: 800,
    boxSizing: 'border-box',
    minWidth: 0,
  },
  mainBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    minWidth: 0,
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
    alignItems: 'flex-start',
    minWidth: 0,
    flex: 1,
    gap: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 1,
    color: 'var(--pz-muted)',
  },
  stopName: {
    maxWidth: '100%',
    fontSize: 15,
    fontWeight: 800,
    color: 'var(--pz-ink)',
    letterSpacing: -0.2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  stopSub: {
    maxWidth: '100%',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--pz-muted)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  chev: {
    fontSize: 24,
    lineHeight: 1,
    color: 'var(--pz-muted)',
    flexShrink: 0,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  arrivedBtn: {
    flex: 1,
    minWidth: 0,
    height: 44,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    border: 'none',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    backgroundColor: 'var(--pz-accent)',
    color: 'var(--pz-on-accent)',
    touchAction: 'manipulation',
  },
  arrivedOn: {
    backgroundColor: 'var(--pz-ok-bg)',
    color: 'var(--pz-ok)',
    border: '1.5px solid var(--pz-ok)',
  },
  iconBtn: {
    width: 44,
    height: 44,
    flexShrink: 0,
    borderRadius: 12,
    border: '1px solid var(--pz-line)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    backgroundColor: 'var(--pz-bg)',
    color: 'var(--pz-ink)',
    touchAction: 'manipulation',
  },
};

export default NextStopBottomDock;
