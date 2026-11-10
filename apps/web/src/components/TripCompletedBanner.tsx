import React from 'react';

interface TripCompletedBannerProps {
  fromPlace: string;
  toPlace: string;
  days: number;
  distanceKm?: number;
  onShareMilestones: () => void;
}

export default function TripCompletedBanner({
  fromPlace,
  toPlace,
  days,
  distanceKm,
  onShareMilestones,
}: TripCompletedBannerProps) {
  return (
    <div style={styles.banner}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        <div style={styles.trophyIcon}>🏆</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={styles.completedTag}>EXPEDITION COMPLETED</span>
            <span style={{ fontSize: 12, color: '#9D9C9A' }}>
              {days} Day{days !== 1 ? 's' : ''} Touring
              {distanceKm ? ` · ${distanceKm} km` : ''}
            </span>
          </div>
          <div style={styles.routeText}>
            {fromPlace} ➔ {toPlace}
          </div>
        </div>
      </div>

      <button
        onClick={onShareMilestones}
        style={styles.btnShare}
        title="Share trip completion milestones"
      >
        <span>🏆</span>
        <span>Share Milestones</span>
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  banner: {
    backgroundColor: 'rgba(240, 194, 58, 0.1)',
    border: '1.5px solid rgba(240, 194, 58, 0.45)',
    borderRadius: 16,
    padding: '14px 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  trophyIcon: {
    fontSize: 28,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(240, 194, 58, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedTag: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1,
    padding: '2px 8px',
    borderRadius: 6,
    backgroundColor: '#F0C23A',
    color: '#111316',
  },
  routeText: {
    margin: '3px 0 0',
    fontSize: 15,
    fontWeight: 900,
    color: '#F1EFEA',
  },
  btnShare: {
    padding: '10px 18px',
    backgroundColor: '#F0C23A',
    color: '#111316',
    border: 'none',
    borderRadius: 10,
    fontWeight: 900,
    fontSize: 13,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    boxShadow: '0 4px 14px rgba(240, 194, 58, 0.3)',
    whiteSpace: 'nowrap',
  },
};

