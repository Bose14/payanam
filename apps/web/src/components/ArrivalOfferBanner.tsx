import React from 'react';
import Icon from './Icon';

export interface ArrivalOfferBannerProps {
  stopName: string;
  distanceMeters: number;
  onConfirmArrival: () => void;
  onDismiss: () => void;
}

export const ArrivalOfferBanner: React.FC<ArrivalOfferBannerProps> = ({
  stopName,
  distanceMeters,
  onConfirmArrival,
  onDismiss,
}) => {
  return (
    <div style={styles.container}>
      <div style={styles.contentLeft}>
        <div style={styles.iconDisc}><Icon name="target" /></div>
        <div>
          <div style={styles.badgeRow}>
            <span style={styles.badge}>ARRIVAL DETECTED</span>
            <span style={styles.distanceText}>{Math.round(distanceMeters)} m away</span>
          </div>
          <h4 style={styles.title}>You've entered {stopName}</h4>
          <p style={styles.sub}>Offer to mark arrived so your group gathers without asking.</p>
        </div>
      </div>

      <div style={styles.btnRow}>
        <button
          type="button"
          onClick={onConfirmArrival}
          style={styles.confirmBtn}
        >
          Mark arrived
        </button>
        <button
          type="button"
          onClick={onDismiss}
          style={styles.dismissBtn}
          title="Not stopping here"
        >
          <Icon name="close" />
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    margin: '0 12px 8px 12px',
    padding: '10px 14px',
    borderRadius: 18,
    border: '1.5px solid var(--pz-ok)',
    backgroundColor: 'var(--pz-surface)',
    boxShadow: '0 4px 18px var(--pz-ok-bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexShrink: 0,
    zIndex: 35,
    animation: 'slideDown 0.25s ease-out',
  },
  contentLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
    flex: 1,
  },
  iconDisc: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'var(--pz-ok-bg)',
    border: '1px solid var(--pz-ok)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    flexShrink: 0,
  },
  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    fontSize: 8.5,
    fontWeight: 900,
    letterSpacing: 0.6,
    color: 'var(--pz-ok)',
    textTransform: 'uppercase',
  },
  distanceText: {
    fontSize: 9.5,
    fontWeight: 700,
    color: 'var(--pz-muted)',
  },
  title: {
    margin: '1px 0 0',
    fontSize: 13,
    fontWeight: 900,
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  sub: {
    margin: '2px 0 0',
    fontSize: 10.5,
    color: 'var(--pz-muted)',
    fontWeight: 500,
  },
  btnRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  confirmBtn: {
    padding: '7px 12px',
    borderRadius: 10,
    border: 'none',
    backgroundColor: 'var(--pz-ok)',
    color: 'var(--pz-on-accent)',
    fontWeight: 900,
    fontSize: 11,
    cursor: 'pointer',
    boxShadow: '0 2px 8px var(--pz-ok-bg)',
    transition: 'all 0.15s ease',
  },
  dismissBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: '1px solid var(--pz-line)',
    backgroundColor: 'var(--pz-bg)',
    color: 'var(--pz-muted)',
    fontSize: 11,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
};

