import React from 'react';
import {
  TripMilestoneSummary,
  MilestoneCardCustomization,
  BACKDROP_PRESETS,
} from '../utils/tripMilestones';
import Icon from './Icon';

interface TripMilestoneCardProps {
  summary: TripMilestoneSummary;
  customization: MilestoneCardCustomization;
  onLinkClick?: () => void;
}

/**
 * The badge is a picture people share, so it keeps its own colours (light text on a rich
 * backdrop) in both day and night mode instead of following the app theme.
 */
const INK = '#FFFFFF';
const INK_SOFT = 'rgba(255, 255, 255, 0.72)';
const PANEL = 'rgba(255, 255, 255, 0.10)';
const PANEL_LINE = 'rgba(255, 255, 255, 0.16)';

export default function TripMilestoneCard({ summary, customization, onLinkClick }: TripMilestoneCardProps) {
  const backdrop = BACKDROP_PRESETS.find((b) => b.id === customization.backdropPreset) || BACKDROP_PRESETS[0];
  const accent = backdrop.accent;
  const showSubtitle = summary.title && !summary.title.toLowerCase().startsWith(summary.fromPlace.toLowerCase());

  const stats: Array<{ value: string | number; label: string; accent?: boolean }> = [];
  if (customization.showDistance) stats.push({ value: summary.totalDistanceKm, label: 'KM', accent: true });
  if (customization.showDays) stats.push({ value: summary.daysCount, label: summary.daysCount === 1 ? 'DAY' : 'DAYS' });
  if (customization.showStops) stats.push({ value: summary.stopsClearedCount, label: 'STOPS' });
  if (customization.showRiders && summary.coRidersCount > 1) stats.push({ value: summary.coRidersCount, label: 'RIDERS' });

  const chips: string[] = [];
  if (summary.fuelStopsCount > 0) chips.push(`${summary.fuelStopsCount} fuel`);
  if (summary.mealStopsCount > 0) chips.push(`${summary.mealStopsCount} ${summary.mealStopsCount === 1 ? 'meal' : 'meals'}`);
  if (summary.scenicPointsCount > 0) chips.push(`${summary.scenicPointsCount} scenic`);
  const bike = customization.showBikeModel && summary.bikeModel ? summary.bikeModel : '';

  return (
    <div
      style={{
        ...styles.card,
        background: customization.customPhotoUrl
          ? `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.85)), url(${customization.customPhotoUrl}) center/cover`
          : backdrop.gradient,
        borderColor: accent,
      }}
    >
      <div style={styles.topRow}>
        <span style={{ ...styles.badge, color: accent, borderColor: accent }}>
          <Icon name="trophy" />
          <span>EXPEDITION COMPLETED</span>
        </span>
        <span style={styles.date}>{summary.completedAt}</span>
      </div>

      <div style={{ margin: '18px 0 16px' }}>
        <h2 style={styles.route}>
          <span>{summary.fromPlace}</span>
          <span style={{ color: accent, margin: '0 8px' }}>→</span>
          <span>{summary.toPlace}</span>
        </h2>
        {showSubtitle && <div style={styles.subtitle}>{summary.title}</div>}
      </div>

      {stats.length > 0 && (
        <div style={{ ...styles.stats, gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
          {stats.map((st) => (
            <div key={st.label} style={styles.statBox}>
              <div style={{ ...styles.statValue, color: st.accent ? accent : INK }}>{st.value}</div>
              <div style={styles.statLabel}>{st.label}</div>
            </div>
          ))}
        </div>
      )}

      {(chips.length > 0 || bike) && (
        <div style={styles.chipRow}>
          {chips.map((c) => <span key={c} style={styles.chip}>{c}</span>)}
          {bike && <span style={{ ...styles.chip, color: accent, borderColor: accent, marginLeft: 'auto' }}>{bike}</span>}
        </div>
      )}

      {customization.customNote && (
        <div style={{ ...styles.quote, borderLeftColor: accent }}>
          “{customization.customNote}”
        </div>
      )}

      <div style={styles.footer}>
        {summary.isPublished ? (
          <button type="button" onClick={onLinkClick} style={{ ...styles.footerPill, cursor: 'pointer', font: 'inherit' }}
            title="Open the public itinerary in Discover">
            <Icon name="globe" />
            <span>Verified on Payanam Discover</span>
          </button>
        ) : (
          <span style={styles.footerPill}>
            <Icon name="shield" />
            <span>Private stops hidden</span>
          </span>
        )}
        <span style={styles.brand}>
          <Icon name="bike" />
          <span>PAYANAM</span>
        </span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    borderRadius: 20,
    border: '2px solid',
    padding: '18px 18px 16px',
    boxShadow: '0 12px 30px rgba(0, 0, 0, 0.30)',
    display: 'flex',
    flexDirection: 'column',
    color: INK,
    overflow: 'hidden',
    boxSizing: 'border-box',
  },
  topRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  badge: {
    display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
    fontSize: 10.5, fontWeight: 900, letterSpacing: 1,
    padding: '6px 10px', borderRadius: 999, border: '1px solid', background: 'rgba(0,0,0,0.28)',
  },
  date: { fontSize: 11.5, fontWeight: 700, color: INK_SOFT, whiteSpace: 'nowrap' },
  route: {
    margin: 0, fontSize: 24, lineHeight: 1.2, fontWeight: 900, color: INK, letterSpacing: 0.2,
    display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', rowGap: 2,
    wordBreak: 'break-word',
  },
  subtitle: { fontSize: 12.5, color: INK_SOFT, marginTop: 6 },
  stats: { display: 'grid', gap: 8, marginBottom: 12 },
  statBox: {
    background: PANEL, border: `1px solid ${PANEL_LINE}`, borderRadius: 14,
    padding: '12px 6px', textAlign: 'center', minWidth: 0,
  },
  statValue: { fontSize: 26, fontWeight: 900, lineHeight: 1.05 },
  statLabel: { fontSize: 9.5, fontWeight: 800, letterSpacing: 1, color: INK_SOFT, marginTop: 6 },
  chipRow: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 12 },
  chip: {
    fontSize: 11.5, fontWeight: 700, color: INK, background: PANEL,
    border: `1px solid ${PANEL_LINE}`, borderRadius: 999, padding: '4px 10px', whiteSpace: 'nowrap',
  },
  quote: {
    fontSize: 13, fontStyle: 'italic', color: INK, lineHeight: 1.45,
    background: 'rgba(0,0,0,0.25)', borderLeft: '3px solid', borderRadius: 8, padding: '10px 12px', marginBottom: 12,
  },
  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap',
    borderTop: `1px solid ${PANEL_LINE}`, paddingTop: 12, marginTop: 2,
  },
  footerPill: {
    display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: INK_SOFT,
    background: PANEL, border: `1px solid ${PANEL_LINE}`, borderRadius: 999, padding: '5px 10px',
  },
  brand: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 900, letterSpacing: 1.6, color: INK_SOFT },
};
