import React, { useState } from 'react';

interface TripCompletedBannerProps {
  fromPlace: string;
  toPlace: string;
  days: number;
  distanceKm?: number;
  onShareMilestones: () => void;
  onDismiss?: () => void;
}

export default function TripCompletedBanner({
  fromPlace,
  toPlace,
  days,
  distanceKm,
  onShareMilestones,
  onDismiss,
}: TripCompletedBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div className="trip-completed-banner" style={styles.banner}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        <div style={styles.trophyIcon}>🏆</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={styles.completedTag}>EXPEDITION COMPLETED</span>
            <span style={{ fontSize: 12, color: 'var(--pz-muted, var(--text-secondary))', fontWeight: 600 }}>
              {days} Day{days !== 1 ? 's' : ''} Touring
              {distanceKm ? ` · ${distanceKm} km` : ''}
            </span>
          </div>
          <div style={styles.routeText}>
            {fromPlace} ➔ {toPlace}
          </div>
        </div>
      </div>

      <div style={styles.actionWrap} className="trip-completed-actions">
        <button
          onClick={onShareMilestones}
          style={styles.btnShare}
          title="Share trip completion milestones"
        >
          <span>🏆</span>
          <span>Share Milestones</span>
        </button>
        <button
          onClick={handleDismiss}
          style={styles.btnDismiss}
          title="Dismiss completed banner"
          aria-label="Dismiss banner"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  banner: {
    backgroundColor: 'var(--accent-gold-bg, rgba(240, 194, 58, 0.12))',
    border: '1.5px solid var(--accent-gold, rgba(240, 194, 58, 0.5))',
    borderRadius: 16,
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
    boxShadow: '0 2px 10px rgba(240, 194, 58, 0.12)',
  },
  trophyIcon: {
    fontSize: 26,
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'var(--accent-gold-bg, rgba(240, 194, 58, 0.25))',
    border: '1px solid var(--accent-gold, rgba(240, 194, 58, 0.4))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  completedTag: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0.8,
    padding: '3px 8px',
    borderRadius: 6,
    backgroundColor: 'var(--accent-gold, #F0C23A)',
    color: 'var(--pz-on-accent, #111316)',
    display: 'inline-block',
  },
  routeText: {
    margin: '4px 0 0',
    fontSize: 15,
    fontWeight: 900,
    color: 'var(--pz-ink, var(--text-primary))',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  actionWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  btnShare: {
    padding: '10px 16px',
    backgroundColor: 'var(--accent-gold, #F0C23A)',
    color: 'var(--pz-on-accent, #111316)',
    border: 'none',
    borderRadius: 10,
    fontWeight: 900,
    fontSize: 13,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    boxShadow: '0 2px 8px rgba(240, 194, 58, 0.3)',
    whiteSpace: 'nowrap',
    minHeight: 40,
    touchAction: 'manipulation',
  },
  btnDismiss: {
    width: 36,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'transparent',
    border: '1px solid var(--pz-line, rgba(240, 194, 58, 0.3))',
    color: 'var(--pz-muted, var(--text-secondary))',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    touchAction: 'manipulation',
  },
};

