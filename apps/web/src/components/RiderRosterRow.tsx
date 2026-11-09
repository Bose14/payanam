import React from 'react';
import { FreshnessInfo } from '../utils/lastSeen';

export interface RiderRosterData {
  userId: string;
  userName: string;
  isMe: boolean;
  isCaptain?: boolean;
  lat: number;
  lng: number;
  speedKmh?: number;
  quickStatus?: string;
  updatedAt?: string;
  distanceKm?: number | null;
  color: string;
  freshness: FreshnessInfo;
}

interface RiderRosterRowProps {
  rider: RiderRosterData;
  onClick?: (rider: RiderRosterData) => void;
}

export const RiderRosterRow: React.FC<RiderRosterRowProps> = ({ rider, onClick }) => {
  const {
    userName,
    isMe,
    isCaptain,
    speedKmh = 0,
    quickStatus,
    distanceKm,
    color,
    freshness,
  } = rider;

  const initial = (userName || '?')[0].toUpperCase();

  // Subtitle logic matching mockups:
  // e.g. "Captain · 1 min ago"
  // e.g. "Need fuel · 10:42"
  // e.g. "Last position 6 min ago"
  let subtitle = '';
  if (isCaptain) {
    subtitle = `Captain · ${freshness.ageLabel}`;
  } else if (quickStatus) {
    subtitle = `${quickStatus} · ${freshness.ageLabel}`;
  } else if (freshness.isUnknown) {
    subtitle = `Last position ${freshness.ageLabel}`;
  } else if (speedKmh > 5) {
    subtitle = `${Math.round(speedKmh)} km/h · ${freshness.ageLabel}`;
  } else {
    subtitle = freshness.ageLabel;
  }

  // Right status badge label (matching mockups: LIVE, BEHIND, UNKNOWN)
  let badgeLabel = freshness.badgeLabel;
  let badgeColor = freshness.badgeTextColor;
  let badgeBorder = freshness.badgeBorderColor;
  let badgeBg = 'transparent';

  if (quickStatus && quickStatus.toLowerCase().includes('behind')) {
    badgeLabel = 'BEHIND';
    badgeColor = '#F0C23A';
    badgeBorder = '#F0C23A';
    badgeBg = 'rgba(240, 194, 58, 0.12)';
  } else if (freshness.isStale && !quickStatus) {
    badgeLabel = 'STALE';
    badgeColor = '#F0C23A';
    badgeBorder = '#F0C23A';
    badgeBg = 'rgba(240, 194, 58, 0.12)';
  } else if (freshness.isLive) {
    badgeLabel = 'LIVE';
    badgeColor = '#10B981';
    badgeBorder = '#10B981';
    badgeBg = 'rgba(16, 185, 129, 0.12)';
  } else if (freshness.isUnknown) {
    badgeLabel = 'UNKNOWN';
    badgeColor = '#9D9C9A';
    badgeBorder = '#9D9C9A';
    badgeBg = 'rgba(157, 156, 154, 0.12)';
  }

  return (
    <div
      onClick={() => onClick && onClick(rider)}
      style={{
        ...styles.rowCard,
        borderColor: isMe ? '#F0C23A' : '#2A2E35',
        opacity: freshness.isUnknown ? 0.8 : 1,
      }}
    >
      {/* Avatar (solid for live, hollow for stale/unknown matching mockup) */}
      <div
        style={{
          ...styles.avatar,
          background: freshness.isLive ? '#22262D' : '#111316',
          color: freshness.isLive ? '#F1EFEA' : color,
          border: freshness.isLive ? '2px solid #3A3F47' : `2.5px ${freshness.isStale ? 'dashed' : 'solid'} ${color}`,
        }}
      >
        {initial}
      </div>

      {/* Info column */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={styles.nameRow}>
          <span style={styles.name}>
            {userName}
            {isMe && <span style={styles.youTag}> (You)</span>}
          </span>
          {isCaptain && <span style={styles.crownTag} title="Trip Captain">👑</span>}
        </div>
        <p style={styles.subtitle} title={rider.updatedAt ? new Date(rider.updatedAt).toLocaleTimeString() : undefined}>
          {subtitle}
        </p>
      </div>

      {/* Right column: Badge & Distance */}
      <div style={styles.rightCol}>
        <div
          style={{
            ...styles.badge,
            color: badgeColor,
            borderColor: badgeBorder,
            backgroundColor: badgeBg,
          }}
        >
          {badgeLabel}
        </div>

        {/* Derived distance: If stale/unknown, show "Position stale", NOT confident wrong distance */}
        {!isMe && (
          <div style={styles.distanceText}>
            {freshness.isUnknown ? (
              <span style={{ color: '#9D9C9A', fontSize: 11, fontWeight: 500 }}>Position stale</span>
            ) : distanceKm != null ? (
              <span style={{ color: freshness.isLive ? '#10B981' : '#F0C23A', fontWeight: 700 }}>
                {distanceKm.toFixed(1)} km
              </span>
            ) : (
              <span style={{ color: '#9D9C9A' }}>--</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  rowCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    backgroundColor: '#1B1E23',
    borderRadius: 18,
    marginBottom: 8,
    border: '1.5px solid #2A2E35',
    cursor: 'pointer',
    transition: 'transform 0.15s ease, background-color 0.15s ease',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900,
    fontSize: 16,
    flexShrink: 0,
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontWeight: 800,
    fontSize: 15,
    color: '#F1EFEA',
    letterSpacing: -0.2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  youTag: {
    fontSize: 12,
    fontWeight: 600,
    color: '#9D9C9A',
  },
  crownTag: {
    fontSize: 14,
  },
  subtitle: {
    margin: '2px 0 0',
    fontSize: 12,
    color: '#9D9C9A',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  rightCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 0,
  },
  badge: {
    padding: '3px 8px',
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0.5,
    border: '1.5px solid transparent',
    textTransform: 'uppercase',
  },
  distanceText: {
    fontSize: 12,
    fontWeight: 700,
  },
};

export default RiderRosterRow;
