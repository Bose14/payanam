import React from 'react';
import { PinnedStopData } from './PinStopModal';
import { FreshnessInfo } from '../utils/lastSeen';

interface RiderWithFreshness {
  userId: string;
  userName: string;
  isMe: boolean;
  freshness: FreshnessInfo;
  distanceKm?: number | null;
  speedKmh?: number;
  arrivalStatus?: 'arrived' | 'en_route' | 'departed' | 'missed';
  arrivedAt?: string;
  isMissed?: boolean;
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
  onClearPin?: () => void;
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
  onClearPin,
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
  const passedRiders: string[] = [];
  const unknownRiders: string[] = [];

  riders.forEach((r) => {
    if (r.arrivalStatus === 'arrived') {
      hereRiders.push(r.userName);
    } else if (r.isMissed || r.arrivalStatus === 'missed') {
      passedRiders.push(r.userName);
    } else if (r.freshness.isStale || r.freshness.isUnknown) {
      unknownRiders.push(r.userName);
    } else {
      const dist = r.distanceKm;
      const speed = r.speedKmh && r.speedKmh > 10 ? r.speedKmh : 50;
      const etaStr = dist != null ? `~${Math.max(1, Math.round((dist / speed) * 60))} min` : 'En route';
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
            {pinnedStop.type === 'fuel_stop' ? 'Fuel Stop' :
             pinnedStop.type === 'meal' ? 'Food & Meals' :
             pinnedStop.type === 'rest' ? 'Chai Break' : 'Convoy Target'}
            {myDistanceKm != null ? ` · ${myDistanceKm.toFixed(1)} km to go` : ''}
          </p>
        </div>

        {/* Two Big Stat Boxes (Screen 2 mockup signature) */}
        <div style={styles.statCardsGrid}>
          {/* Left Stat Box */}
          <div
            style={{
              ...styles.statCard,
              borderColor: staleRider ? 'var(--pz-accent)' : 'var(--pz-line)',
              background: staleRider ? 'var(--pz-warn-bg)' : 'var(--pz-bg)',
            }}
          >
            <span
              style={{
                ...styles.statVal,
                color: staleRider ? 'var(--pz-accent)' : 'var(--text-primary)',
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
                color: myEtaDisplay === 'Unknown' ? 'var(--pz-muted)' : isMeArrived ? 'var(--pz-ok)' : 'var(--text-primary)',
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

          {/* Row 3: PASSED / MISSED (Feature J) */}
          {passedRiders.length > 0 && (
            <div style={styles.arrivalRow}>
              <span style={styles.badgePassed}>PASSED</span>
              <span style={{ ...styles.arrivalNames, color: 'var(--pz-bad)' }}>
                {passedRiders.join(', ')} (passed stop)
              </span>
            </div>
          )}

          {/* Row 4: UNKNOWN (Stale riders) */}
          <div style={{ ...styles.arrivalRow, borderBottom: 'none' }}>
            <span style={styles.badgeUnknown}>UNKNOWN</span>
            <span style={{ ...styles.arrivalNames, color: 'var(--pz-muted)' }}>
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
              background: isMeArrived ? 'var(--pz-ok)' : 'var(--pz-accent)',
              color: isMeArrived ? '#FFFFFF' : 'var(--pz-bg)',
            }}
          >
            {isMeArrived ? 'I am here' : "I'm here"}
          </button>

          <button
            type="button"
            onClick={() => onOpenNavigation({ name: pinnedStop.name, lat: pinnedStop.lat, lng: pinnedStop.lng })}
            style={styles.secondaryBtn}
          >
            Open in navigation app
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
          {onClearPin && (
            <button
              type="button"
              onClick={onClearPin}
              style={{ ...styles.changeBtn, color: 'var(--pz-bad)', border: '1px solid var(--pz-bad)', borderRadius: 12, padding: '10px', fontSize: 13, fontWeight: 700 }}
            >
              Clear target stop
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(5px)',
    WebkitBackdropFilter: 'blur(5px)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: 540,
    backgroundColor: 'var(--pz-surface)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTop: '1.5px solid var(--pz-line)',
    padding: '12px 20px 28px',
    boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.5)',
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
    backgroundColor: 'var(--pz-line)',
  },
  header: {
    marginBottom: 16,
  },
  pretitle: {
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--pz-muted)',
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
    color: 'var(--text-primary)',
    margin: 0,
    lineHeight: 1.2,
  },
  approachingBadge: {
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    border: '1.5px solid var(--pz-ok)',
    color: 'var(--pz-ok)',
    background: 'var(--pz-ok-bg)',
    letterSpacing: 0.5,
  },
  stopMeta: {
    fontSize: 13,
    color: 'var(--pz-muted)',
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
    border: '1.5px solid var(--pz-line)',
    backgroundColor: 'var(--pz-bg)',
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
    color: 'var(--pz-muted)',
    fontWeight: 600,
    marginTop: 6,
    lineHeight: 1.2,
  },
  arrivalsSection: {
    backgroundColor: 'var(--pz-bg)',
    border: '1.5px solid var(--pz-line)',
    borderRadius: 18,
    padding: '14px 16px',
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--pz-muted)',
    letterSpacing: 1,
    margin: '0 0 12px',
    textTransform: 'uppercase',
  },
  arrivalRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 0',
    borderBottom: '1px solid var(--pz-line)',
  },
  badgeHere: {
    padding: '3px 8px',
    borderRadius: 999,
    background: 'var(--pz-ok-bg)',
    color: 'var(--pz-ok)',
    border: '1.5px solid var(--pz-ok)',
    fontWeight: 900,
    fontSize: 10,
    letterSpacing: 0.5,
    minWidth: 55,
    textAlign: 'center',
  },
  badgeETA: {
    padding: '3px 8px',
    borderRadius: 999,
    background: 'var(--pz-warn-bg)',
    color: 'var(--pz-warn)',
    border: '1.5px solid var(--pz-accent)',
    fontWeight: 900,
    fontSize: 10,
    letterSpacing: 0.5,
    minWidth: 55,
    textAlign: 'center',
  },
  badgeUnknown: {
    padding: '3px 8px',
    borderRadius: 999,
    background: 'rgba(157, 156, 154, 0.15)',
    color: 'var(--pz-muted)',
    border: '1.5px solid var(--pz-muted)',
    fontWeight: 900,
    fontSize: 10,
    letterSpacing: 0.5,
    minWidth: 55,
    textAlign: 'center',
  },
  badgePassed: {
    padding: '3px 8px',
    borderRadius: 999,
    background: 'var(--pz-bad-bg)',
    color: 'var(--pz-bad)',
    border: '1.5px solid var(--pz-bad)',
    fontWeight: 900,
    fontSize: 10,
    letterSpacing: 0.5,
    minWidth: 55,
    textAlign: 'center',
  },
  arrivalNames: {
    fontSize: 13,
    color: 'var(--text-primary)',
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
    backgroundColor: 'var(--pz-accent)',
    color: 'var(--pz-on-accent)',
    boxShadow: '0 4px 14px var(--pz-warn-bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtn: {
    width: '100%',
    padding: '13px 20px',
    borderRadius: 14,
    border: '1.5px solid var(--pz-line)',
    backgroundColor: 'var(--pz-surface)',
    color: 'var(--text-primary)',
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
    color: 'var(--pz-muted)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    padding: '6px',
    textAlign: 'center',
  },
};

