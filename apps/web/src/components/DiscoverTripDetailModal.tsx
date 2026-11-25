import React from 'react';
import { PublishedTrip } from '../utils/publicItinerary';
import Icon from './Icon';

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
              <span style={styles.publicBadge}>DISCOVER ITINERARY</span>
              <span style={{ fontSize: 12, color: 'var(--pz-warn)', fontWeight: 800 }}>
                {trip.rating.toFixed(1)} ({trip.finishersCount} finishers)
              </span>
            </div>
            <h3 style={styles.title}>{trip.title}</h3>
            <div style={styles.authorLine}>
              Curated by <strong style={{ color: 'var(--text-primary)' }}>{trip.authorName}</strong> ·{' '}
              <span style={{ color: 'var(--pz-warn)' }}>{trip.copiesCount} riders copied</span>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}><Icon name="close" /></button>
        </div>

        {/* Tags bar */}
        <div style={styles.tagsBar}>
          {trip.tags.map((t) => (
            <span key={t} style={styles.tagChip}>{t}</span>
          ))}
          <span style={styles.routePill}>
            {trip.fromPlace} to {trip.toPlace} ({trip.days} Days)
          </span>
        </div>

        {/* Content */}
        <div style={styles.body}>
          {trip.description && (
            <div style={styles.descBox}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--pz-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                Rider Overview
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {trip.description}
              </p>
            </div>
          )}

          {/* Privacy Note */}
          <div style={styles.privacyNote}>
            <span><Icon name="shield" /></span>
            <span>
              <strong>Privacy protected:</strong> Exact home departure coordinate & private stays are sanitized.
            </span>
          </div>

          {/* Amenities Summary */}
          <div style={styles.amenitiesCard}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--pz-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
              Waypoint Amenities Breakdown
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={styles.amenityItem}><span>Fuel</span> <strong>{fuel}</strong></div>
              <div style={styles.amenityItem}><span>Food</span> <strong>{food}</strong></div>
              <div style={styles.amenityItem}><span>Rest</span> <strong>{rest}</strong></div>
              <div style={styles.amenityItem}><span>Scenic</span> <strong>{scenic}</strong></div>
            </div>
          </div>

          {/* Stops List */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--pz-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
              Curated Stops & Waypoints ({trip.stops?.length ?? 0})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {trip.stops?.map((stop, idx) => (
                <div key={stop.id || idx} style={styles.stopCard}>
                  <div style={styles.stopIndex}>{idx + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
                        {stop.place}
                      </span>
                      <span style={styles.stopTypePill}>{stop.item_type || 'stop'}</span>
                    </div>

                    {stop.description && (
                      <div style={{ fontSize: 12, color: 'var(--pz-muted)', marginTop: 3 }}>
                        {stop.description}
                      </div>
                    )}

                    {stop.tips && (
                      <div style={styles.stopTipsBox}>
                        <span>Tip:</span> {stop.tips}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Source Attribution Notice */}
          <div style={styles.sourceCreditBox}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pz-warn)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span><Icon name="food" /></span> Source Attribution Guarantee
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--pz-muted)', lineHeight: 1.4 }}>
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
              backgroundColor: isCopied ? 'var(--pz-ok)' : 'var(--pz-accent)',
            }}
          >
            <span><Icon name={isCopied ? 'check' : 'list'} /></span>
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
    backgroundColor: 'var(--pz-surface)',
    border: '1.5px solid var(--pz-line)',
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
    borderBottom: '1px solid var(--pz-line)',
  },
  publicBadge: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1,
    padding: '2px 8px',
    borderRadius: 6,
    backgroundColor: 'var(--pz-warn-bg)',
    color: 'var(--pz-warn)',
    border: '1px solid var(--pz-accent)',
  },
  title: {
    margin: '6px 0 2px',
    fontSize: 18,
    fontWeight: 900,
    color: 'var(--text-primary)',
  },
  authorLine: {
    fontSize: 12,
    color: 'var(--pz-muted)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--pz-muted)',
    fontSize: 18,
    cursor: 'pointer',
    padding: 4,
  },
  tagsBar: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    padding: '10px 22px',
    backgroundColor: 'var(--pz-bg)',
    borderBottom: '1px solid var(--pz-line)',
    flexWrap: 'wrap',
  },
  tagChip: {
    fontSize: 10,
    fontWeight: 800,
    padding: '2px 8px',
    borderRadius: 6,
    backgroundColor: 'var(--pz-surface)',
    border: '1px solid var(--pz-line)',
    color: 'var(--pz-ok)',
  },
  routePill: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--pz-muted)',
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
    backgroundColor: 'var(--pz-bg)',
    border: '1px solid var(--pz-line)',
    borderRadius: 12,
    padding: '12px 14px',
  },
  privacyNote: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 11,
    color: 'var(--pz-ok)',
    backgroundColor: 'var(--pz-ok-bg)',
    border: '1px solid var(--pz-ok)',
    borderRadius: 10,
    padding: '8px 12px',
  },
  amenitiesCard: {
    backgroundColor: 'var(--pz-bg)',
    border: '1px solid var(--pz-line)',
    borderRadius: 12,
    padding: '12px 14px',
  },
  amenityItem: {
    fontSize: 12,
    color: 'var(--text-primary)',
    backgroundColor: 'var(--pz-surface)',
    padding: '4px 10px',
    borderRadius: 8,
    border: '1px solid var(--pz-line)',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  stopCard: {
    display: 'flex',
    gap: 12,
    backgroundColor: 'var(--pz-bg)',
    border: '1px solid var(--pz-line)',
    borderRadius: 12,
    padding: '10px 14px',
  },
  stopIndex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'var(--pz-line)',
    color: 'var(--pz-warn)',
    fontSize: 11,
    fontWeight: 900,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopTypePill: {
    fontSize: 10,
    fontWeight: 800,
    color: 'var(--pz-muted)',
    backgroundColor: 'var(--pz-surface)',
    border: '1px solid var(--pz-line)',
    padding: '2px 6px',
    borderRadius: 4,
    textTransform: 'uppercase',
  },
  stopTipsBox: {
    fontSize: 11,
    color: 'var(--pz-warn)',
    backgroundColor: 'var(--pz-warn-bg)',
    padding: '4px 8px',
    borderRadius: 6,
    marginTop: 6,
  },
  sourceCreditBox: {
    backgroundColor: 'var(--pz-bg)',
    border: '1px dashed var(--pz-line)',
    borderRadius: 12,
    padding: '12px 14px',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    padding: '14px 22px',
    borderTop: '1px solid var(--pz-line)',
    backgroundColor: 'var(--pz-surface)',
  },
  btnSecondary: {
    padding: '9px 16px',
    backgroundColor: 'var(--pz-bg)',
    border: '1.5px solid var(--pz-line)',
    borderRadius: 10,
    color: 'var(--text-primary)',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  btnCopyPrimary: {
    padding: '9px 20px',
    color: 'var(--pz-on-accent)',
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

