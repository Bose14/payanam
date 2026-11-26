import React from 'react';
import {
  OffRouteAlert,
  formatOffRouteDistance,
  formatOffRouteDuration,
} from '../utils/routeDeviation';
import Icon from './Icon';

export interface RouteDeviationCardProps {
  alerts: OffRouteAlert[];
  isCaptain: boolean;
  currentUserId?: string;
  onRegroup: (alert: OffRouteAlert) => void;
  onFocusRider: (lat: number, lng: number) => void;
  onNavigateBack?: (lat: number, lng: number) => void;
  onDismiss?: (userId: string) => void;
}

export const RouteDeviationCard: React.FC<RouteDeviationCardProps> = ({
  alerts,
  isCaptain,
  currentUserId,
  onRegroup,
  onFocusRider,
  onNavigateBack,
  onDismiss,
}) => {
  if (!alerts || alerts.length === 0) {
    return null;
  }

  // Display the most significant deviation first
  const primaryAlert = alerts[0];
  const isMe = primaryAlert.userId === currentUserId;
  const otherCount = alerts.length - 1;

  return (
    <div style={styles.cardContainer}>
      {/* Alert Header Row */}
      <div style={styles.headerRow}>
        <div style={styles.badgeWrap}>
          <span style={styles.alertIcon}><Icon name="warning" /></span>
          <span style={styles.badgeText}>
            ROUTE DEVIATION{otherCount > 0 ? ` (+${otherCount})` : ''}
          </span>
        </div>
        <div style={styles.metricsWrap}>
          <span style={styles.metricDistance}>
            {formatOffRouteDistance(primaryAlert.distanceMeters)} off
          </span>
          <span style={styles.metricDuration}>
            · {formatOffRouteDuration(primaryAlert.durationSeconds)}
          </span>
          {onDismiss && (
            <button
              type="button"
              onClick={() => onDismiss(primaryAlert.userId)}
              style={styles.dismissBtn}
              aria-label="Dismiss alert"
            >
              <Icon name="close" />
            </button>
          )}
        </div>
      </div>

      {/* Rider Info Row */}
      <div style={styles.bodyRow}>
        <div style={styles.avatar}>
          {isMe ? 'YOU' : primaryAlert.userName.slice(0, 2).toUpperCase()}
        </div>
        <div style={styles.textWrap}>
          <h4 style={styles.riderTitle}>
            {isMe
              ? 'You are off the planned route'
              : `${primaryAlert.userName} is off the route`}
          </h4>
          <p style={styles.riderSub}>
            {isMe
              ? `Separated by ${formatOffRouteDistance(primaryAlert.distanceMeters)} for ${formatOffRouteDuration(primaryAlert.durationSeconds)}. Rejoin line or alert group.`
              : `Separated from convoy line by ${formatOffRouteDistance(primaryAlert.distanceMeters)} for ${formatOffRouteDuration(primaryAlert.durationSeconds)}.`}
          </p>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div style={styles.actionRow}>
        {/* If Current User is off route: option to navigate back */}
        {isMe && onNavigateBack && (
          <button
            type="button"
            onClick={() => onNavigateBack(primaryAlert.nearestRoutePoint[0], primaryAlert.nearestRoutePoint[1])}
            style={styles.rejoinBtn}
          >
            Rejoin route
          </button>
        )}

        {/* Focus on Map */}
        <button
          type="button"
          onClick={() => onFocusRider(primaryAlert.lat, primaryAlert.lng)}
          style={styles.secondaryBtn}
        >
          Show on map
        </button>

        {/* Requirement 4: Captain acts -> "The captain can tap Regroup, which sends an announcement to everyone." */}
        {isCaptain && (
          <button
            type="button"
            onClick={() => onRegroup(primaryAlert)}
            style={styles.regroupBtn}
          >
            Regroup
          </button>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  cardContainer: {
    margin: '4px 12px 8px',
    padding: '12px 14px',
    backgroundColor: 'var(--pz-surface)',
    border: '1.5px solid var(--pz-bad)',
    borderRadius: 18,
    boxShadow: '0 6px 24px var(--pz-bad-bg)',
    zIndex: 950,
    animation: 'slideDown 0.25s ease-out',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badgeWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  alertIcon: {
    fontSize: 13,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: '0.06em',
    color: 'var(--pz-bad)',
    textTransform: 'uppercase',
  },
  metricsWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  metricDistance: {
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--text-primary)',
  },
  metricDuration: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--pz-muted)',
  },
  dismissBtn: {
    marginLeft: 6,
    background: 'none',
    border: 'none',
    color: 'var(--pz-muted)',
    fontSize: 13,
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
  },
  bodyRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'var(--pz-bad-bg)',
    border: '1.5px solid var(--pz-bad)',
    color: 'var(--pz-bad)',
    fontSize: 11,
    fontWeight: 900,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  textWrap: {
    minWidth: 0,
    flex: 1,
  },
  riderTitle: {
    margin: 0,
    fontSize: 13.5,
    fontWeight: 800,
    color: 'var(--text-primary)',
    letterSpacing: '-0.01em',
    lineHeight: 1.25,
  },
  riderSub: {
    margin: '2px 0 0',
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--pz-muted)',
    lineHeight: 1.35,
  },
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  regroupBtn: {
    flex: 1,
    padding: '8px 12px',
    backgroundColor: 'var(--pz-accent)',
    color: 'var(--pz-on-accent)',
    border: 'none',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 900,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    boxShadow: '0 2px 8px var(--pz-warn-bg)',
    transition: 'all 0.15s ease',
  },
  rejoinBtn: {
    flex: 1,
    padding: '8px 12px',
    backgroundColor: 'var(--pz-ok)',
    color: 'var(--pz-on-ok)',
    border: 'none',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryBtn: {
    padding: '8px 12px',
    backgroundColor: 'var(--pz-line)',
    color: 'var(--text-primary)',
    border: '1px solid var(--pz-line)',
    borderRadius: 12,
    fontSize: 11.5,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  },
};

