import { useState, useMemo, useEffect } from 'react';
import {
  PublishedTrip,
  getPublishedTrips,
  copyTripToMyTrips,
  CopiedDraftTrip,
} from '../utils/publicItinerary';
import DiscoverTripCard from './DiscoverTripCard';
import DiscoverTripDetailModal from './DiscoverTripDetailModal';

interface DiscoverTabProps {
  currentUser?: {
    id: string;
    fullName: string;
  } | null;
  onTripCopied?: (draft: CopiedDraftTrip) => void;
  _onNavigateToTrip?: (tripId: string) => void;
  onOpenPublishFlow?: () => void;
}

const FILTER_TAGS = ['ALL', 'TWISTY', '3-5 DAYS', 'GHATS', 'COASTAL', 'WEEKEND', 'MIXED'];

export default function DiscoverTab({
  currentUser,
  onTripCopied,
  _onNavigateToTrip,
  onOpenPublishFlow,
}: DiscoverTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('ALL');
  const [publishedTrips, setPublishedTrips] = useState<PublishedTrip[]>([]);
  const [previewTrip, setPreviewTrip] = useState<PublishedTrip | null>(null);
  const [copiedTripId, setCopiedTripId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load published trips from localStorage / seed
  useEffect(() => {
    setPublishedTrips(getPublishedTrips());
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Step 4: "Discoverable - Searches by destination find it"
  const filteredTrips = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return publishedTrips.filter((trip) => {
      // Destination & keyword search
      const matchesSearch =
        !q ||
        trip.title.toLowerCase().includes(q) ||
        trip.toPlace.toLowerCase().includes(q) ||
        trip.fromPlace.toLowerCase().includes(q) ||
        trip.authorName.toLowerCase().includes(q) ||
        trip.tags.some((t) => t.toLowerCase().includes(q)) ||
        (trip.description && trip.description.toLowerCase().includes(q));

      // Tag filter
      const matchesTag =
        selectedTag === 'ALL' ||
        trip.tags.includes(selectedTag);

      return matchesSearch && matchesTag;
    });
  }, [publishedTrips, searchQuery, selectedTag]);

  // Step 5: "Others copy and edit - Copy to my trips creates a draft that credits the source."
  const handleCopyTrip = (trip: PublishedTrip) => {
    const userObj = currentUser || { id: 'anon', fullName: 'Rider' };
    const draft = copyTripToMyTrips(trip, userObj);
    setCopiedTripId(trip.id);
    showToast(`✓ Copied "${trip.title}" to My Trips! Draft credited to @${trip.authorName}`);
    onTripCopied?.(draft);

    // Refresh trips list to reflect updated copies count
    setPublishedTrips(getPublishedTrips());
  };

  return (
    <div style={styles.container}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={styles.toast}>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Destination Search Box matching Mockup Screen 8 */}
      <div style={styles.searchWrapper}>
        <span style={styles.searchIcon}>🔍</span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by destination: Kasaragod, Coorg, Goa, Ooty..."
          style={styles.searchInput}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={styles.clearBtn}
            title="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filter Chips matching Mockup Screen 8 */}
      <div style={styles.filterChipsRow}>
        {FILTER_TAGS.map((tag) => {
          const isActive = selectedTag === tag;
          return (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              style={isActive ? styles.chipActive : styles.chipInactive}
            >
              {tag}
            </button>
          );
        })}
      </div>

      {/* Publish Itinerary CTA Banner */}
      {onOpenPublishFlow && (
        <div style={styles.publishCtaCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <span style={{ fontSize: 20 }}>🌐</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#F1EFEA' }}>
                Have a great route? Publish your itinerary!
              </div>
              <div style={{ fontSize: 11, color: '#9D9C9A' }}>
                Share with safety shields (home addresses automatically masked)
              </div>
            </div>
          </div>
          <button
            onClick={onOpenPublishFlow}
            style={styles.btnPublishCta}
          >
            Publish Trip
          </button>
        </div>
      )}

      {/* Results Header */}
      <div style={styles.resultsHeader}>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#9D9C9A', textTransform: 'uppercase' }}>
          Discover Routes ({filteredTrips.length})
        </span>
        <span style={{ fontSize: 11, color: '#F0C23A' }}>
          ⭐ Community Verified
        </span>
      </div>

      {/* Published Trips List */}
      <div style={styles.tripsList}>
        {filteredTrips.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🗺️</div>
            <p style={{ fontWeight: 800, color: '#F1EFEA', margin: '0 0 4px', fontSize: 15 }}>
              No itineraries found for "{searchQuery}"
            </p>
            <p style={{ color: '#9D9C9A', fontSize: 13, margin: 0 }}>
              Try searching for popular touring hubs like <strong>Bengaluru</strong>, <strong>Coorg</strong>, <strong>Kasaragod</strong>, or <strong>Goa</strong>.
            </p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedTag('ALL'); }}
              style={styles.btnResetSearch}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          filteredTrips.map((trip) => (
            <DiscoverTripCard
              key={trip.id}
              trip={trip}
              onCopy={handleCopyTrip}
              onPreview={(t) => setPreviewTrip(t)}
              isCopied={copiedTripId === trip.id}
            />
          ))
        )}
      </div>

      {/* Detail / Full Preview Modal */}
      <DiscoverTripDetailModal
        isOpen={Boolean(previewTrip)}
        trip={previewTrip}
        onClose={() => setPreviewTrip(null)}
        onCopy={handleCopyTrip}
        isCopied={previewTrip ? copiedTripId === previewTrip.id : false}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: '#111316',
    padding: '12px 16px',
    position: 'relative',
  },
  toast: {
    position: 'absolute',
    top: 14,
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#10B981',
    color: '#111316',
    padding: '8px 16px',
    borderRadius: 12,
    fontWeight: 900,
    fontSize: 12,
    zIndex: 1000,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
    textAlign: 'center',
    maxWidth: '90%',
  },
  searchWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchIcon: {
    position: 'absolute',
    left: 14,
    fontSize: 14,
    color: '#9D9C9A',
  },
  searchInput: {
    width: '100%',
    padding: '12px 38px 12px 38px',
    borderRadius: 16,
    border: '1.5px solid #2A2E35',
    backgroundColor: '#1B1E23',
    color: '#F1EFEA',
    fontSize: 14,
    fontWeight: 600,
    outline: 'none',
  },
  clearBtn: {
    position: 'absolute',
    right: 12,
    background: 'none',
    border: 'none',
    color: '#9D9C9A',
    fontSize: 14,
    cursor: 'pointer',
    padding: 4,
  },
  filterChipsRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 14,
    overflowX: 'auto',
    paddingBottom: 4,
  },
  chipActive: {
    fontSize: 11,
    fontWeight: 800,
    color: '#10B981',
    border: '1.5px solid #10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    padding: '5px 12px',
    borderRadius: 8,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  chipInactive: {
    fontSize: 11,
    fontWeight: 800,
    color: '#9D9C9A',
    border: '1.5px solid #2A2E35',
    backgroundColor: '#1B1E23',
    padding: '5px 12px',
    borderRadius: 8,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  publishCtaCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(240, 194, 58, 0.08)',
    border: '1.5px dashed rgba(240, 194, 58, 0.4)',
    borderRadius: 14,
    padding: '10px 14px',
    marginBottom: 14,
    gap: 12,
  },
  btnPublishCta: {
    padding: '7px 14px',
    backgroundColor: '#F0C23A',
    color: '#111316',
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 900,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  resultsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    padding: '0 2px',
  },
  tripsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    flex: 1,
    overflowY: 'auto',
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 20px',
    backgroundColor: '#1B1E23',
    borderRadius: 16,
    border: '1.5px dashed #2A2E35',
  },
  btnResetSearch: {
    marginTop: 16,
    padding: '8px 16px',
    backgroundColor: '#111316',
    border: '1.5px solid #F0C23A',
    color: '#F0C23A',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
  },
};
