import React from 'react';
import { PublishedTrip } from '../utils/publicItinerary';
import Icon from './Icon';

interface DiscoverTripCardProps {
  trip: PublishedTrip;
  onCopy: (trip: PublishedTrip) => void;
  onPreview: (trip: PublishedTrip) => void;
  onMessage?: (trip: PublishedTrip) => void;
  isCopied?: boolean;
}

export default function DiscoverTripCard({
  trip,
  onCopy,
  onPreview,
  onMessage,
  isCopied = false,
}: DiscoverTripCardProps) {
  const { fuel = 0, food = 0, rest = 0, scenic = 0 } = trip.amenitiesSummary || {};

  return (
    <div style={styles.card}>
      {/* Top row: Title and Tags */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h4 style={styles.title}>{trip.title}</h4>
            {trip.sourceCredit && (
              <span style={styles.forkedBadge}>FORK</span>
            )}
          </div>
          <div style={styles.authorLine}>
            by <strong style={{ color: 'var(--text-primary)' }}>{trip.authorName}</strong> ·{' '}
            <span style={{ color: 'var(--pz-warn)', fontWeight: 800 }}>{trip.copiesCount} copies</span> ·{' '}
            <span>{trip.rating.toFixed(1)} from {trip.finishersCount} riders</span>
          </div>
        </div>

        {/* First Tag Highlight */}
        {trip.tags?.[0] && (
          <span style={styles.primaryTag}>{trip.tags[0]}</span>
        )}
      </div>

      {/* Description if available */}
      {trip.description && (
        <p style={styles.descText}>{trip.description}</p>
      )}

      {/* Stops breakdown matching Mockup Screen 8 */}
      <div style={styles.stopsBreakdownRow}>
        <span style={styles.stopsSummaryLabel}>Stops:</span>
        {fuel > 0 && <span style={styles.stopPill} title="fuel"><Icon name="fuel" /> {fuel}</span>}
        {food > 0 && <span style={styles.stopPill} title="food"><Icon name="food" /> {food}</span>}
        {rest > 0 && <span style={styles.stopPill} title="rest"><Icon name="coffee" /> {rest}</span>}
        {scenic > 0 && <span style={styles.stopPill} title="scenic"><Icon name="camera" /> {scenic}</span>}
        <span style={{ fontSize: 11, color: 'var(--pz-muted)', marginLeft: 'auto' }}>
          {trip.stops?.length ?? 0} total waypoints
        </span>
      </div>

      {/* Tags List */}
      {trip.tags && trip.tags.length > 1 && (
        <div style={styles.tagsContainer}>
          {trip.tags.slice(1).map((tag) => (
            <span key={tag} style={styles.subTag}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions matching Mockup Screen 8 */}
      <div style={styles.actionsRow}>
        <button
          type="button"
          onClick={() => onCopy(trip)}
          style={{
            ...styles.btnCopy,
            backgroundColor: isCopied ? 'var(--pz-ok)' : 'var(--pz-accent)',
            color: 'var(--pz-on-accent)',
          }}
          title="Create a copy of this itinerary in your trips, crediting the author"
        >
          <span><Icon name={isCopied ? 'check' : 'list'} /></span>
          <span>{isCopied ? 'Copied to Trips' : 'Copy to my trips'}</span>
        </button>

        <button
          type="button"
          onClick={() => onPreview(trip)}
          style={styles.btnSecondary}
          title="Preview stops and notes"
        >
          <span><Icon name="eye" /></span>
          <span>View Stops</span>
        </button>

        {onMessage && (
          <button
            type="button"
            onClick={() => onMessage(trip)}
            style={styles.btnSecondary}
            title="Message group"
          >
            <span><Icon name="chat" /></span>
            <span>Message</span>
          </button>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: 'var(--pz-surface)',
    border: '1.5px solid var(--pz-line)',
    borderRadius: 18,
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    transition: 'border-color 0.2s ease',
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 900,
    color: 'var(--text-primary)',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  forkedBadge: {
    fontSize: 10,
    fontWeight: 900,
    backgroundColor: 'var(--pz-warn-bg)',
    border: '1px solid var(--pz-accent)',
    color: 'var(--pz-warn)',
    padding: '1px 6px',
    borderRadius: 4,
  },
  authorLine: {
    fontSize: 12,
    color: 'var(--pz-muted)',
    marginTop: 4,
  },
  primaryTag: {
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--pz-ok)',
    border: '1.5px solid var(--pz-ok)',
    padding: '3px 8px',
    borderRadius: 6,
    letterSpacing: 0.5,
  },
  descText: {
    margin: '2px 0 0',
    fontSize: 12,
    color: 'var(--pz-muted)',
    lineHeight: 1.45,
  },
  stopsBreakdownRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    fontSize: 12,
    color: 'var(--pz-muted)',
    marginTop: 2,
  },
  stopsSummaryLabel: {
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  stopPill: {
    fontSize: 11,
    color: 'var(--text-primary)',
    backgroundColor: 'var(--pz-bg)',
    border: '1px solid var(--pz-line)',
    padding: '2px 8px',
    borderRadius: 6,
  },
  tagsContainer: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  subTag: {
    fontSize: 10,
    fontWeight: 800,
    color: 'var(--pz-muted)',
    border: '1px solid var(--pz-line)',
    padding: '2px 8px',
    borderRadius: 6,
  },
  actionsRow: {
    display: 'flex',
    gap: 10,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  btnCopy: {
    padding: '9px 16px',
    border: 'none',
    borderRadius: 10,
    fontWeight: 800,
    fontSize: 13,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    transition: 'transform 0.1s ease',
  },
  btnSecondary: {
    padding: '9px 14px',
    backgroundColor: 'var(--pz-bg)',
    color: 'var(--text-primary)',
    border: '1.5px solid var(--pz-line)',
    borderRadius: 10,
    fontWeight: 800,
    fontSize: 13,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
};

