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

  if (quickStatus && quickStatus.toLowerCase().includes('behind')) {
    badgeLabel = 'BEHIND';
    badgeColor = '#f59e0b';
    badgeBorder = '#f59e0b';
  } else if (freshness.isStale && !quickStatus) {
    badgeLabel = 'STALE';
  }

  return (
    <div
      onClick={() => onClick && onClick(rider)}
      style={{
        ...styles.rowCard,
        borderColor: isMe ? 'var(--accent-gold, #f59e0b)' : 'var(--border-card, #374151)',
        opacity: freshness.isUnknown ? 0.75 : 1,
      }}
    >
      {/* Avatar (solid for live, hollow for stale/unknown) */}
      <div
        style={{
          ...styles.avatar,
          background: freshness.isLive ? color : '#111827',
          color: freshness.isLive ? '#ffffff' : color,
          border: freshness.isLive ? '2px solid #ffffff' : `2.5px ${freshness.isStale ? 'dashed' : 'solid'} ${color}`,
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
            background: freshness.badgeBgColor,
          }}
        >
          {badgeLabel}
        </div>

        {/* Derived distance: If stale/unknown, show "Position stale", NOT confident wrong distance */}
        {!isMe && (
          <div style={styles.distanceText}>
            {freshness.isUnknown ? (
              <span style={{ color: '#9ca3af', fontSize: 11 }}>Position stale</span>
            ) : distanceKm != null ? (
              <span style={{ color: freshness.isLive ? '#10b981' : '#f59e0b', fontWeight: 700 }}>
                {distanceKm.toFixed(1)} km
              </span>
            ) : (
              <span style={{ color: '#9ca3af' }}>--</span>
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
    background: 'var(--bg-card, #1f2937)',
    borderRadius: 14,
    marginBottom: 8,
    border: '1px solid #374151',
    cursor: 'pointer',
    transition: 'transform 0.15s ease, background-color 0.15s ease',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 16,
    flexShrink: 0,
    boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontWeight: 800,
    fontSize: 15,
    color: 'var(--text-primary, #ffffff)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  youTag: {
    fontSize: 12,
    fontWeight: 600,
    color: '#9ca3af',
  },
  crownTag: {
    fontSize: 13,
  },
  subtitle: {
    margin: '2px 0 0',
    fontSize: 12,
    color: 'var(--text-secondary, #9ca3af)',
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
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.5,
    border: '1.5px solid transparent',
    textTransform: 'uppercase',
  },
  distanceText: {
    fontSize: 12,
    fontWeight: 600,
  },
};

export default RiderRosterRow;

