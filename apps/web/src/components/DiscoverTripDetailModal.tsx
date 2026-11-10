import React from 'react';
import { PublishedTrip } from '../utils/publicItinerary';

interface DiscoverTripDetailModalProps {
  isOpen: boolean;
  trip: PublishedTrip | null;
  onClose: () => void;
  onCopy: (trip: PublishedTrip) => void;
  isCopied?: boolean;
}

export default function DiscoverTripDetailModal({
  isOpen,
  trip,
  onClose,
  onCopy,
  isCopied = false,
}: DiscoverTripDetailModalProps) {
  if (!isOpen || !trip) return null;

  const { fuel = 0, food = 0, rest = 0, scenic = 0 } = trip.amenitiesSummary || {};

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={styles.publicBadge}>🌐 DISCOVER ITINERARY</span>
              <span style={{ fontSize: 12, color: '#F0C23A', fontWeight: 800 }}>
                {trip.rating.toFixed(1)} ★ ({trip.finishersCount} finishers)
              </span>
            </div>
            <h3 style={styles.title}>{trip.title}</h3>
            <div style={styles.authorLine}>
              Curated by <strong style={{ color: '#F1EFEA' }}>{trip.authorName}</strong> ·{' '}
              <span style={{ color: '#F0C23A' }}>{trip.copiesCount} riders copied</span>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        {/* Tags bar */}
        <div style={styles.tagsBar}>
          {trip.tags.map((t) => (
            <span key={t} style={styles.tagChip}>{t}</span>
          ))}
          <span style={styles.routePill}>
            {trip.fromPlace} ➔ {trip.toPlace} ({trip.days} Days)
          </span>
        </div>

        {/* Content */}
        <div style={styles.body}>
          {trip.description && (
            <div style={styles.descBox}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#9D9C9A', textTransform: 'uppercase', marginBottom: 4 }}>
                Rider Overview
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#F1EFEA', lineHeight: 1.5 }}>
                {trip.description}
              </p>
            </div>
          )}

          {/* Privacy Note */}
          <div style={styles.privacyNote}>
            <span>🛡️</span>
            <span>
              <strong>Privacy protected:</strong> Exact home departure coordinate & private stays are sanitized.
            </span>
          </div>

          {/* Amenities Summary */}
          <div style={styles.amenitiesCard}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#9D9C9A', textTransform: 'uppercase', marginBottom: 8 }}>
              Waypoint Amenities Breakdown
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={styles.amenityItem}><span>⛽ Fuel</span> <strong>{fuel}</strong></div>
              <div style={styles.amenityItem}><span>🍽️ Food</span> <strong>{food}</strong></div>
              <div style={styles.amenityItem}><span>☕ Rest</span> <strong>{rest}</strong></div>
              <div style={styles.amenityItem}><span>📸 Scenic</span> <strong>{scenic}</strong></div>
            </div>
          </div>

          {/* Stops List */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#9D9C9A', textTransform: 'uppercase', marginBottom: 10 }}>
              Curated Stops & Waypoints ({trip.stops?.length ?? 0})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {trip.stops?.map((stop, idx) => (
                <div key={stop.id || idx} style={styles.stopCard}>
                  <div style={styles.stopIndex}>{idx + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#F1EFEA' }}>
                        {stop.place}
                      </span>
                      <span style={styles.stopTypePill}>{stop.item_type || 'stop'}</span>
                    </div>

                    {stop.description && (
                      <div style={{ fontSize: 12, color: '#9D9C9A', marginTop: 3 }}>
                        {stop.description}
                      </div>
                    )}

                    {stop.tips && (
                      <div style={styles.stopTipsBox}>
                        <span>💡 Tip:</span> {stop.tips}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Source Attribution Notice */}
          <div style={styles.sourceCreditBox}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#F0C23A', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🍴</span> Source Attribution Guarantee
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9D9C9A', lineHeight: 1.4 }}>
              When you copy this itinerary, a draft trip is created under your account with full credit to{' '}
              <strong>@{trip.authorName}</strong>. You can freely customize stops, timing, and add co-riders.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button onClick={onClose} style={styles.btnSecondary}>
            Close
          </button>
          <button
            onClick={() => onCopy(trip)}
            style={{
              ...styles.btnCopyPrimary,
              backgroundColor: isCopied ? '#10B981' : '#F0C23A',
            }}
          >
            <span>{isCopied ? '✓' : '📋'}</span>
            <span>{isCopied ? 'Copied to My Trips' : 'Copy to my trips'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 16,
  },
  modal: {
    backgroundColor: '#1B1E23',
    border: '1.5px solid #2A2E35',
    borderRadius: 20,
    width: '100%',
    maxWidth: 600,
    maxHeight: '88vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '20px 22px 14px',
    borderBottom: '1px solid #2A2E35',
  },
  publicBadge: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1,
    padding: '2px 8px',
    borderRadius: 6,
    backgroundColor: 'rgba(240, 194, 58, 0.15)',
    color: '#F0C23A',
    border: '1px solid #F0C23A',
  },
  title: {
    margin: '6px 0 2px',
    fontSize: 18,
    fontWeight: 900,
    color: '#F1EFEA',
  },
  authorLine: {
    fontSize: 12,
    color: '#9D9C9A',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#9D9C9A',
    fontSize: 18,
    cursor: 'pointer',
    padding: 4,
  },
  tagsBar: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    padding: '10px 22px',
    backgroundColor: '#111316',
    borderBottom: '1px solid #2A2E35',
    flexWrap: 'wrap',
  },
  tagChip: {
    fontSize: 10,
    fontWeight: 800,
    padding: '2px 8px',
    borderRadius: 6,
    backgroundColor: '#1B1E23',
    border: '1px solid #2A2E35',
    color: '#10B981',
  },
  routePill: {
    fontSize: 11,
    fontWeight: 700,
    color: '#9D9C9A',
    marginLeft: 'auto',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '18px 22px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  descBox: {
    backgroundColor: '#111316',
    border: '1px solid #2A2E35',
    borderRadius: 12,
    padding: '12px 14px',
  },
  privacyNote: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 11,
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    borderRadius: 10,
    padding: '8px 12px',
  },
  amenitiesCard: {
    backgroundColor: '#111316',
    border: '1px solid #2A2E35',
    borderRadius: 12,
    padding: '12px 14px',
  },
  amenityItem: {
    fontSize: 12,
    color: '#F1EFEA',
    backgroundColor: '#1B1E23',
    padding: '4px 10px',
    borderRadius: 8,
    border: '1px solid #2A2E35',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  stopCard: {
    display: 'flex',
    gap: 12,
    backgroundColor: '#111316',
    border: '1px solid #2A2E35',
    borderRadius: 12,
    padding: '10px 14px',
  },
  stopIndex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#2A2E35',
    color: '#F0C23A',
    fontSize: 11,
    fontWeight: 900,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopTypePill: {
    fontSize: 10,
    fontWeight: 800,
    color: '#9D9C9A',
    backgroundColor: '#1B1E23',
    border: '1px solid #2A2E35',
    padding: '2px 6px',
    borderRadius: 4,
    textTransform: 'uppercase',
  },
  stopTipsBox: {
    fontSize: 11,
    color: '#F0C23A',
    backgroundColor: 'rgba(240, 194, 58, 0.08)',
    padding: '4px 8px',
    borderRadius: 6,
    marginTop: 6,
  },
  sourceCreditBox: {
    backgroundColor: '#111316',
    border: '1px dashed #2A2E35',
    borderRadius: 12,
    padding: '12px 14px',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    padding: '14px 22px',
    borderTop: '1px solid #2A2E35',
    backgroundColor: '#1B1E23',
  },
  btnSecondary: {
    padding: '9px 16px',
    backgroundColor: '#111316',
    border: '1.5px solid #2A2E35',
    borderRadius: 10,
    color: '#F1EFEA',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  btnCopyPrimary: {
    padding: '9px 20px',
    color: '#111316',
    border: 'none',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 900,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
};

