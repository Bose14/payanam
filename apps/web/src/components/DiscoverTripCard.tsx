import React from 'react';
import { PublishedTrip } from '../utils/publicItinerary';

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
              <span style={styles.forkedBadge}>🍴 FORK</span>
            )}
          </div>
          <div style={styles.authorLine}>
            by <strong style={{ color: '#F1EFEA' }}>{trip.authorName}</strong> ·{' '}
            <span style={{ color: '#F0C23A', fontWeight: 800 }}>{trip.copiesCount} copies</span> ·{' '}
            <span>{trip.rating.toFixed(1)} ★ from {trip.finishersCount} riders</span>
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
        {fuel > 0 && <span style={styles.stopPill}>⛽ fuel {fuel}</span>}
        {food > 0 && <span style={styles.stopPill}>🍽️ food {food}</span>}
        {rest > 0 && <span style={styles.stopPill}>☕ rest {rest}</span>}
        {scenic > 0 && <span style={styles.stopPill}>📸 scenic {scenic}</span>}
        <span style={{ fontSize: 11, color: '#9D9C9A', marginLeft: 'auto' }}>
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
            backgroundColor: isCopied ? '#10B981' : '#F0C23A',
            color: '#111316',
          }}
          title="Create a copy of this itinerary in your trips, crediting the author"
        >
          <span>{isCopied ? '✓' : '📋'}</span>
          <span>{isCopied ? 'Copied to Trips' : 'Copy to my trips'}</span>
        </button>

        <button
          type="button"
          onClick={() => onPreview(trip)}
          style={styles.btnSecondary}
          title="Preview stops and notes"
        >
          <span>👁️</span>
          <span>View Stops</span>
        </button>

        {onMessage && (
          <button
            type="button"
            onClick={() => onMessage(trip)}
            style={styles.btnSecondary}
            title="Message group"
          >
            <span>💬</span>
            <span>Message</span>
          </button>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: '#1B1E23',
    border: '1.5px solid #2A2E35',
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
    color: '#F1EFEA',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  forkedBadge: {
    fontSize: 10,
    fontWeight: 900,
    backgroundColor: 'rgba(240, 194, 58, 0.15)',
    border: '1px solid #F0C23A',
    color: '#F0C23A',
    padding: '1px 6px',
    borderRadius: 4,
  },
  authorLine: {
    fontSize: 12,
    color: '#9D9C9A',
    marginTop: 4,
  },
  primaryTag: {
    fontSize: 11,
    fontWeight: 800,
    color: '#10B981',
    border: '1.5px solid #10B981',
    padding: '3px 8px',
    borderRadius: 6,
    letterSpacing: 0.5,
  },
  descText: {
    margin: '2px 0 0',
    fontSize: 12,
    color: '#9D9C9A',
    lineHeight: 1.45,
  },
  stopsBreakdownRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    fontSize: 12,
    color: '#9D9C9A',
    marginTop: 2,
  },
  stopsSummaryLabel: {
    fontWeight: 700,
    color: '#F1EFEA',
  },
  stopPill: {
    fontSize: 11,
    color: '#F1EFEA',
    backgroundColor: '#111316',
    border: '1px solid #2A2E35',
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
    color: '#9D9C9A',
    border: '1px solid #2A2E35',
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
    backgroundColor: '#111316',
    color: '#F1EFEA',
    border: '1.5px solid #2A2E35',
    borderRadius: 10,
    fontWeight: 800,
    fontSize: 13,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
};

