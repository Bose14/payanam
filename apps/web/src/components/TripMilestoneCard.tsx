import React from 'react';
import {
  TripMilestoneSummary,
  MilestoneCardCustomization,
  BACKDROP_PRESETS,
} from '../utils/tripMilestones';

interface TripMilestoneCardProps {
  summary: TripMilestoneSummary;
  customization: MilestoneCardCustomization;
  onLinkClick?: () => void;
}

export default function TripMilestoneCard({
  summary,
  customization,
  onLinkClick,
}: TripMilestoneCardProps) {
  const currentBackdrop = BACKDROP_PRESETS.find(
    (b) => b.id === customization.backdropPreset
  ) || BACKDROP_PRESETS[0];

  return (
    <div
      style={{
        ...styles.cardWrapper,
        background: customization.customPhotoUrl
          ? `linear-gradient(rgba(0,0,0,0.65), rgba(0,0,0,0.85)), url(${customization.customPhotoUrl}) center/cover`
          : currentBackdrop.gradient,
        borderColor: currentBackdrop.accent,
      }}
    >
      {/* Top Banner Ribbon */}
      <div style={styles.topRow}>
        <div style={styles.badgePill}>
          <span style={{ fontSize: 13 }}>🏆</span>
          <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.2, color: '#F0C23A' }}>
            EXPEDITION COMPLETED
          </span>
        </div>
        <span style={styles.dateStamp}>{summary.completedAt}</span>
      </div>

      {/* Main Route Title */}
      <div style={{ margin: '8px 0 12px' }}>
        <h2 style={styles.routeTitle}>
          {summary.fromPlace} <span style={{ color: currentBackdrop.accent }}>➔</span> {summary.toPlace}
        </h2>
        <div style={styles.subtitleText}>{summary.title}</div>
      </div>

      {/* Stats Ribbon (Step 1) */}
      <div style={styles.statsGrid}>
        {customization.showDistance && (
          <div style={styles.statBox}>
            <div style={{ ...styles.statNumber, color: currentBackdrop.accent }}>
              {summary.totalDistanceKm}
            </div>
            <div style={styles.statLabel}>KILOMETERS</div>
          </div>
        )}

        {customization.showDays && (
          <div style={styles.statBox}>
            <div style={styles.statNumber}>{summary.daysCount}</div>
            <div style={styles.statLabel}>DAYS TOURING</div>
          </div>
        )}

        {customization.showStops && (
          <div style={styles.statBox}>
            <div style={styles.statNumber}>{summary.stopsClearedCount}</div>
            <div style={styles.statLabel}>WAYPOINTS</div>
          </div>
        )}

        {customization.showRiders && summary.coRidersCount > 1 && (
          <div style={styles.statBox}>
            <div style={styles.statNumber}>{summary.coRidersCount}</div>
            <div style={styles.statLabel}>CONVOY RIDERS</div>
          </div>
        )}
      </div>

      {/* Waypoint Amenities Breakdown */}
      <div style={styles.amenitiesStrip}>
        {summary.fuelStopsCount > 0 && <span>⛽ {summary.fuelStopsCount} Fuel</span>}
        {summary.mealStopsCount > 0 && <span>🍽️ {summary.mealStopsCount} Meals</span>}
        {summary.scenicPointsCount > 0 && <span>📸 {summary.scenicPointsCount} Scenic Passes</span>}
        {customization.showBikeModel && summary.bikeModel && (
          <span style={{ marginLeft: 'auto', color: '#F0C23A', fontWeight: 800 }}>
            🏍️ {summary.bikeModel}
          </span>
        )}
      </div>

      {/* Custom Note Quote */}
      {customization.customNote && (
        <div style={styles.quoteBox}>
          <span>💬</span>
          <span style={{ fontStyle: 'italic', color: '#F1EFEA', fontSize: 12 }}>
            "{customization.customNote}"
          </span>
        </div>
      )}

      {/* Bottom Link & Discover Integration (Step 4: Link leads back) */}
      <div style={styles.footerRow}>
        {summary.isPublished ? (
          <div
            onClick={onLinkClick}
            style={styles.discoverPill}
            title="Click to view public itinerary in Discover"
          >
            <span>🌐</span>
            <span style={{ fontWeight: 800 }}>Verified on Payanam Discover · Open Itinerary</span>
            <span>↗</span>
          </div>
        ) : (
          <div style={styles.privacySealPill}>
            <span>🛡️</span>
            <span>Residential & home coordinates omitted for safety</span>
          </div>
        )}

        <div style={styles.brandWatermark}>
          <span>🏍️</span>
          <span>PAYANAM</span>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  cardWrapper: {
    borderRadius: 20,
    border: '2px solid #F0C23A',
    padding: '20px 22px',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65)',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
    transition: 'all 0.3s ease',
  },
  topRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  badgePill: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(240, 194, 58, 0.15)',
    border: '1px solid rgba(240, 194, 58, 0.4)',
    borderRadius: 999,
    padding: '4px 12px',
  },
  dateStamp: {
    fontSize: 11,
    color: '#9D9C9A',
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  routeTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 900,
    color: '#F1EFEA',
    letterSpacing: 0.5,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  subtitleText: {
    fontSize: 12,
    color: '#9D9C9A',
    marginTop: 2,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))',
    gap: 8,
    margin: '12px 0',
  },
  statBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: '8px 10px',
    textAlign: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 900,
    color: '#F1EFEA',
    lineHeight: 1.1,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: 1,
    color: '#9D9C9A',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  amenitiesStrip: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    fontSize: 11,
    color: '#F1EFEA',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    padding: '6px 10px',
    margin: '4px 0 10px',
  },
  quoteBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderLeft: '3px solid #F0C23A',
    borderRadius: 8,
    padding: '8px 12px',
    marginBottom: 12,
  },
  footerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTop: '1px solid rgba(255, 255, 255, 0.12)',
    flexWrap: 'wrap',
    gap: 8,
  },
  discoverPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    border: '1px solid #10B981',
    borderRadius: 8,
    padding: '4px 10px',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
  },
  privacySealPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 10,
    color: '#9D9C9A',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 6,
    padding: '3px 8px',
  },
  brandWatermark: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1.5,
    color: '#9D9C9A',
    marginLeft: 'auto',
  },
};

