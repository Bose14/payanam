import React from 'react';
import { PinnedStopData } from './PinStopModal';
import { FreshnessInfo } from '../utils/lastSeen';

export interface RiderWithFreshness {
  userId: string;
  userName: string;
  isMe: boolean;
  freshness: FreshnessInfo;
  distanceKm?: number | null;
  speedKmh?: number;
  arrivalStatus?: 'arrived' | 'en_route' | 'departed';
  arrivedAt?: string;
}

interface StopDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  pinnedStop: PinnedStopData | null;
  riders: RiderWithFreshness[];
  myDistanceKm?: number | null;
  mySpeedKmh?: number;
  myFreshness: FreshnessInfo;
  isMeArrived: boolean;
  onToggleMyArrival: (isArrived: boolean) => void;
  onOpenNavigation: (target: { name: string; lat: number; lng: number }) => void;
  onChangeStop?: () => void;
}

export const StopDetailSheet: React.FC<StopDetailSheetProps> = ({
  isOpen,
  onClose,
  pinnedStop,
  riders,
  myDistanceKm,
  mySpeedKmh = 0,
  myFreshness,
  isMeArrived,
  onToggleMyArrival,
  onOpenNavigation,
  onChangeStop,
}) => {
  if (!isOpen || !pinnedStop) return null;

  // 1. Calculate Your ETA (Strict Derived Rule: If own position is stale/unknown, show "Unknown", not a guess!)
  let myEtaDisplay = 'Unknown';
  let myEtaSubtext = 'Your ETA';

  if (isMeArrived) {
    myEtaDisplay = 'Arrived';
    myEtaSubtext = 'You are here!';
  } else if (myFreshness.isStale || myFreshness.isUnknown) {
    myEtaDisplay = 'Unknown';
    myEtaSubtext = `Your GPS is ${myFreshness.ageLabel} old`;
  } else if (myDistanceKm != null) {
    if (myDistanceKm < 0.15) {
      myEtaDisplay = 'Arrived';
      myEtaSubtext = 'Within 150m of stop';
    } else {
      const speed = mySpeedKmh > 10 ? mySpeedKmh : 50;
      const mins = Math.max(1, Math.round((myDistanceKm / speed) * 60));
      myEtaDisplay = `~${mins} min`;
      myEtaSubtext = `${myDistanceKm.toFixed(1)} km away`;
    }
  }

  // 2. Identify stale/unknown riders to populate Left Stat Card (matching mockup: "Unknown - Suresh's position is 6 min old")
  const staleRider = riders.find((r) => !r.isMe && (r.freshness.isUnknown || r.freshness.isStale));
  const otherLiveRiders = riders.filter((r) => !r.isMe && r.freshness.isLive && r.arrivalStatus !== 'arrived');

  let leftCardDisplay = 'All Live';
  let leftCardSubtext = 'All positions active';

  if (staleRider) {
    leftCardDisplay = 'Unknown';
    leftCardSubtext = `${staleRider.userName}'s position is ${staleRider.freshness.ageLabel} old`;
  } else if (otherLiveRiders.length > 0) {
    // Show closest follower ETA
    const closest = [...otherLiveRiders].sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))[0];
    if (closest.distanceKm != null) {
      const mins = Math.max(1, Math.round((closest.distanceKm / 50) * 60));
      leftCardDisplay = `~${mins} min`;
      leftCardSubtext = `${closest.userName}'s ETA`;
    }
  }

  // 3. Partition riders into ARRIVALS categories matching mockup:
  // - HERE: Arrived riders
  // - ETA / EN ROUTE: Live riders with known position
  // - UNKNOWN: Riders with stale or unknown position (> 30s)
  const hereRiders: string[] = [];
  const enRouteRiders: { name: string; eta: string }[] = [];
  const unknownRiders: string[] = [];

  riders.forEach((r) => {
    if (r.arrivalStatus === 'arrived') {
      hereRiders.push(r.userName);
    } else if (r.freshness.isStale || r.freshness.isUnknown) {
      unknownRiders.push(r.userName);
    } else {
      const dist = r.distanceKm;
      const etaStr = dist != null ? `~${Math.max(1, Math.round((dist / 50) * 60))} min` : 'En route';
      enRouteRiders.push({ name: r.userName, eta: etaStr });
    }
  });

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
        {/* Top Drag Handle */}
        <div style={styles.handleWrap} onClick={onClose}>
          <div style={styles.handle} />
        </div>

        {/* Header matching mockup */}
        <div style={styles.header}>
          <span style={styles.pretitle}>NEXT STOP</span>
          <div style={styles.titleRow}>
            <h2 style={styles.title}>{pinnedStop.name}</h2>
            <span style={styles.approachingBadge}>
              {isMeArrived ? 'HERE' : 'APPROACHING'}
            </span>
          </div>
          <p style={styles.stopMeta}>
            {pinnedStop.type === 'fuel_stop' ? '⛽ Fuel Stop' :
             pinnedStop.type === 'meal' ? '🍽️ Food & Meals' :
             pinnedStop.type === 'rest' ? '☕ Chai Break' : '📍 Convoy Target'}
            {myDistanceKm != null ? ` · ${myDistanceKm.toFixed(1)} km to go` : ''}
          </p>
        </div>

        {/* Two Big Stat Boxes (Screen 2 mockup signature) */}
        <div style={styles.statCardsGrid}>
          {/* Left Stat Box */}
          <div
            style={{
              ...styles.statCard,
              borderColor: staleRider ? '#f59e0b' : '#374151',
              background: staleRider ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-subtle, #1f2937)',
            }}
          >
            <span
              style={{
                ...styles.statVal,
                color: staleRider ? '#f59e0b' : 'var(--text-primary, #ffffff)',
              }}
            >
              {leftCardDisplay}
            </span>
            <span style={styles.statSub}>{leftCardSubtext}</span>
          </div>

          {/* Right Stat Box: Your ETA */}
          <div style={styles.statCard}>
            <span
              style={{
                ...styles.statVal,
                color: myEtaDisplay === 'Unknown' ? '#9ca3af' : isMeArrived ? '#10b981' : 'var(--text-primary, #ffffff)',
              }}
            >
              {myEtaDisplay}
            </span>
            <span style={styles.statSub}>{myEtaSubtext}</span>
          </div>
        </div>

        {/* Section: ARRIVALS */}
        <div style={styles.arrivalsSection}>
          <h3 style={styles.sectionHeader}>ARRIVALS</h3>

          {/* Row 1: HERE */}
          <div style={styles.arrivalRow}>
            <span style={styles.badgeHere}>HERE</span>
            <span style={styles.arrivalNames}>
              {hereRiders.length > 0 ? hereRiders.join(', ') : 'None yet'}
            </span>
          </div>

          {/* Row 2: EN ROUTE / LIVE ETAs */}
          {enRouteRiders.length > 0 && (
            <div style={styles.arrivalRow}>
              <span style={styles.badgeETA}>
                {enRouteRiders[0].eta.toUpperCase()}
              </span>
              <span style={styles.arrivalNames}>
                {enRouteRiders.map((r) => `${r.name} (${r.eta})`).join(', ')}
              </span>
            </div>
          )}

          {/* Row 3: UNKNOWN (Stale riders) */}
          <div style={styles.arrivalRow}>
            <span style={styles.badgeUnknown}>UNKNOWN</span>
            <span style={{ ...styles.arrivalNames, color: '#9ca3af' }}>
              {unknownRiders.length > 0
                ? unknownRiders.join(', ')
                : 'All positions live'}
            </span>
          </div>
        </div>

        {/* Action Buttons matching mockup */}
        <div style={styles.btnRow}>
          <button
            type="button"
            onClick={() => onToggleMyArrival(!isMeArrived)}
            style={{
              ...styles.primaryBtn,
              background: isMeArrived ? '#10b981' : 'var(--accent-gold, #f59e0b)',
              color: isMeArrived ? '#ffffff' : '#000000',
            }}
          >
            {isMeArrived ? '✓ I am here' : "I'm here"}
          </button>

          <button
            type="button"
            onClick={() => onOpenNavigation({ name: pinnedStop.name, lat: pinnedStop.lat, lng: pinnedStop.lng })}
            style={styles.secondaryBtn}
          >
            🧭 Open in navigation app
          </button>

          {onChangeStop && (
            <button
              type="button"
              onClick={onChangeStop}
              style={styles.changeBtn}
            >
              Change Target Stop
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: 540,
    backgroundColor: 'var(--bg-card, #111827)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTop: '1px solid var(--border-card, #374151)',
    padding: '12px 20px 28px',
    boxShadow: '0 -8px 30px rgba(0, 0, 0, 0.5)',
    animation: 'slideUp 0.25s ease-out',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  handleWrap: {
    display: 'flex',
    justifyContent: 'center',
    padding: '4px 0 12px',
    cursor: 'pointer',
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#4b5563',
  },
  header: {
    marginBottom: 16,
  },
  pretitle: {
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--text-secondary, #9ca3af)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: 900,
    color: 'var(--text-primary, #ffffff)',
    margin: 0,
    lineHeight: 1.2,
  },
  approachingBadge: {
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    border: '1.5px solid #10b981',
    color: '#10b981',
    background: 'rgba(16, 185, 129, 0.12)',
    letterSpacing: 0.5,
  },
  stopMeta: {
    fontSize: 13,
    color: 'var(--text-secondary, #9ca3af)',
    margin: '6px 0 0',
  },
  statCardsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    padding: '16px 14px',
    borderRadius: 16,
    border: '1.5px solid #374151',
    backgroundColor: '#1f2937',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    minHeight: 88,
  },
  statVal: {
    fontSize: 26,
    fontWeight: 900,
    lineHeight: 1.1,
    letterSpacing: -0.5,
  },
  statSub: {
    fontSize: 12,
    color: 'var(--text-secondary, #9ca3af)',
    fontWeight: 600,
    marginTop: 6,
    lineHeight: 1.2,
  },
  arrivalsSection: {
    backgroundColor: '#1f2937',
    border: '1px solid #374151',
    borderRadius: 16,
    padding: '14px 16px',
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: 800,
    color: '#9ca3af',
    letterSpacing: 1,
    margin: '0 0 12px',
    textTransform: 'uppercase',
  },
  arrivalRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 0',
    borderBottom: '1px solid #2d3748',
  },
  badgeHere: {
    padding: '3px 8px',
    borderRadius: 6,
    background: '#10b981',
    color: '#064e3b',
    fontWeight: 900,
    fontSize: 10,
    letterSpacing: 0.5,
    minWidth: 55,
    textAlign: 'center',
  },
  badgeETA: {
    padding: '3px 8px',
    borderRadius: 6,
    background: '#f59e0b',
    color: '#78350f',
    fontWeight: 900,
    fontSize: 10,
    letterSpacing: 0.5,
    minWidth: 55,
    textAlign: 'center',
  },
  badgeUnknown: {
    padding: '3px 8px',
    borderRadius: 6,
    background: '#4b5563',
    color: '#d1d5db',
    fontWeight: 900,
    fontSize: 10,
    letterSpacing: 0.5,
    minWidth: 55,
    textAlign: 'center',
  },
  arrivalNames: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: 600,
    flex: 1,
  },
  btnRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  primaryBtn: {
    width: '100%',
    padding: '14px 20px',
    borderRadius: 14,
    border: 'none',
    fontWeight: 900,
    fontSize: 16,
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(245, 158, 11, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtn: {
    width: '100%',
    padding: '13px 20px',
    borderRadius: 14,
    border: '1.5px solid #4b5563',
    backgroundColor: 'transparent',
    color: '#ffffff',
    fontWeight: 800,
    fontSize: 14,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  changeBtn: {
    background: 'none',
    border: 'none',
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    padding: '6px',
    textAlign: 'center',
  },
};

export default StopDetailSheet;
