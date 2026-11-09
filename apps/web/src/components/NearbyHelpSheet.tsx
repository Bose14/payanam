import React, { useState } from 'react';
import { formatVerifiedAge } from '../utils/lastSeen';

export type NearbyCategory = 'ALL' | 'FUEL' | 'REPAIR' | 'FOOD' | 'REST';

export interface NearbyPlaceItem {
  id: string;
  category: 'FUEL' | 'REPAIR' | 'FOOD' | 'REST';
  name: string;
  subtitle: string;
  distanceKm: number;
  verifiedAt: string; // ISO date string
  lat: number;
  lng: number;
  notes?: string;
}

interface NearbyHelpSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentGps?: { lat: number; lng: number } | null;
  onNavigate?: (target: { name: string; lat: number; lng: number }) => void;
  onPinAsStop?: (item: { name: string; lat: number; lng: number; type: string }) => void;
}

// Route-cached fallback amenity data (matching Mockup 3 UX)
const DEFAULT_NEARBY_LISTINGS: NearbyPlaceItem[] = [
  {
    id: 'p1',
    category: 'FUEL',
    name: 'HP Petrol Pump, Sagar',
    subtitle: '4 km ahead · open 24 h',
    distanceKm: 4.2,
    verifiedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(), // 3 days ago
    lat: 14.1670,
    lng: 75.0333,
  },
  {
    id: 'p2',
    category: 'FUEL',
    name: 'IOCL, Shimoga Road',
    subtitle: '11 km ahead · closes 21:00',
    distanceKm: 11.5,
    verifiedAt: new Date(Date.now() - 120 * 24 * 3600 * 1000).toISOString(), // 4 months ago
    lat: 14.1200,
    lng: 75.1000,
  },
  {
    id: 'p3',
    category: 'REPAIR',
    name: 'Apex Bike Care & Puncture Shop',
    subtitle: '6 km ahead · tubeless repair & chain lube',
    distanceKm: 6.1,
    verifiedAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(), // 5 days ago
    lat: 14.1500,
    lng: 75.0500,
  },
  {
    id: 'p4',
    category: 'FOOD',
    name: 'Sagar Highway Dhaba',
    subtitle: '8 km ahead · chai, parathas, good parking',
    distanceKm: 8.0,
    verifiedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(), // 2 days ago
    lat: 14.1400,
    lng: 75.0700,
  },
  {
    id: 'p5',
    category: 'REST',
    name: 'Ghat Viewpoint Shelter',
    subtitle: '14 km ahead · shaded benches, water refill',
    distanceKm: 14.3,
    verifiedAt: new Date(Date.now() - 18 * 24 * 3600 * 1000).toISOString(), // 18 days ago
    lat: 14.0800,
    lng: 75.1300,
  },
  {
    id: 'p6',
    category: 'REPAIR',
    name: 'Royal Enfield Authorized Garage',
    subtitle: '22 km ahead · clutch cables & brake pads',
    distanceKm: 22.0,
    verifiedAt: new Date(Date.now() - 210 * 24 * 3600 * 1000).toISOString(), // 7 months ago
    lat: 13.9800,
    lng: 75.2500,
  },
];

export const NearbyHelpSheet: React.FC<NearbyHelpSheetProps> = ({
  isOpen,
  onClose,
  currentGps,
  onNavigate,
  onPinAsStop,
}) => {
  const [activeCategory, setActiveCategory] = useState<NearbyCategory>('FUEL');
  const [selectedId, setSelectedId] = useState<string>('p1');

  if (!isOpen) return null;

  const filteredItems = DEFAULT_NEARBY_LISTINGS.filter((item) => {
    if (activeCategory === 'ALL') return true;
    return item.category === activeCategory;
  });

  const selectedItem = DEFAULT_NEARBY_LISTINGS.find((i) => i.id === selectedId) || filteredItems[0];

  const handleNavigateClick = () => {
    if (!selectedItem) return;
    if (onNavigate) {
      onNavigate({
        name: selectedItem.name,
        lat: currentGps ? selectedItem.lat : selectedItem.lat,
        lng: currentGps ? selectedItem.lng : selectedItem.lng,
      });
    }
    onClose();
  };

  const handlePinClick = () => {
    if (!selectedItem) return;
    if (onPinAsStop) {
      onPinAsStop({
        name: selectedItem.name,
        lat: selectedItem.lat,
        lng: selectedItem.lng,
        type: selectedItem.category === 'FUEL' ? 'fuel_stop' : selectedItem.category === 'FOOD' ? 'meal' : selectedItem.category === 'REPAIR' ? 'stop' : 'rest',
      });
    }
    onClose();
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
        {/* Handle */}
        <div style={styles.handleWrap} onClick={onClose}>
          <div style={styles.handle} />
        </div>

        {/* Header */}
        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.title}>Nearby help</h2>
          </div>
          <span style={styles.alongRouteBadge}>Along route</span>
        </div>

        {/* Filter Pills */}
        <div style={styles.filterRow}>
          {(['FUEL', 'REPAIR', 'FOOD', 'REST'] as NearbyCategory[]).map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setActiveCategory(cat);
                  const firstInCat = DEFAULT_NEARBY_LISTINGS.find((i) => i.category === cat);
                  if (firstInCat) setSelectedId(firstInCat.id);
                }}
                style={{
                  ...styles.filterPill,
                  backgroundColor: isActive ? '#F0C23A' : '#111316',
                  color: isActive ? '#111316' : '#9D9C9A',
                  borderColor: isActive ? '#F0C23A' : '#2A2E35',
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Listings */}
        <div style={styles.listingsScroll}>
          {filteredItems.map((item) => {
            const isSelected = item.id === selectedId;
            const verifiedLabel = formatVerifiedAge(item.verifiedAt);
            const isOld = verifiedLabel.includes('MONTH') || verifiedLabel.includes('YEAR') || verifiedLabel === 'UNVERIFIED';

            return (
              <div
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                style={{
                  ...styles.itemCard,
                  borderColor: isSelected ? '#F0C23A' : '#2A2E35',
                  backgroundColor: isSelected ? 'rgba(240, 194, 58, 0.08)' : '#1B1E23',
                }}
              >
                <div style={styles.itemCategoryBadge}>
                  {item.category}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.itemName}>{item.name}</div>
                  <div style={styles.itemSubtitle}>{item.subtitle}</div>

                  {/* Verified Date Badge (Last-seen for amenities) */}
                  <div style={{ marginTop: 4 }}>
                    <span
                      style={{
                        ...styles.verifiedBadge,
                        color: isOld ? '#9D9C9A' : '#10B981',
                        backgroundColor: isOld ? 'rgba(157, 156, 154, 0.12)' : 'rgba(16, 185, 129, 0.15)',
                        borderColor: isOld ? '#2A2E35' : '#10B981',
                      }}
                    >
                      {verifiedLabel}
                    </span>
                  </div>
                </div>

                <div style={styles.radioIndicator}>
                  {isSelected ? (
                    <div style={styles.radioSelected} />
                  ) : (
                    <div style={styles.radioUnselected} />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Offline cache note */}
        <div style={styles.cacheNote}>
          <span style={{ fontSize: 13 }}>💾</span>
          <span>Cached for this route, so listings show with no signal.</span>
        </div>

        {/* Action Buttons */}
        <div style={styles.actionRow}>
          <button
            type="button"
            onClick={handleNavigateClick}
            disabled={!selectedItem}
            style={styles.btnPrimary}
          >
            🧭 Navigate to selected
          </button>
          {onPinAsStop && (
            <button
              type="button"
              onClick={handlePinClick}
              disabled={!selectedItem}
              style={styles.btnSecondary}
            >
              📌 Pin as stop
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
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    animation: 'fadeIn 0.2s ease-out',
  },
  sheet: {
    backgroundColor: '#1B1E23',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTop: '1.5px solid #2A2E35',
    padding: '12px 18px 24px',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.5)',
    color: '#F1EFEA',
  },
  handleWrap: {
    width: '100%',
    padding: '4px 0 10px',
    display: 'flex',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#3A3F47',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: 900,
    letterSpacing: -0.5,
    margin: 0,
    color: '#F1EFEA',
  },
  subtitle: {
    fontSize: 12,
    color: '#9D9C9A',
    marginTop: 2,
    display: 'block',
  },
  alongRouteBadge: {
    fontSize: 12,
    fontWeight: 600,
    color: '#9D9C9A',
  },
  filterRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 14,
    overflowX: 'auto',
    paddingBottom: 4,
  },
  filterPill: {
    padding: '6px 14px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 800,
    border: '1.5px solid',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  },
  listingsScroll: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    maxHeight: '44vh',
    paddingRight: 2,
  },
  itemCard: {
    border: '1.5px solid',
    borderRadius: 16,
    padding: '12px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  itemCategoryBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#111316',
    border: '1.5px solid #2A2E35',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900,
    fontSize: 10,
    color: '#F1EFEA',
    letterSpacing: 0.5,
    flexShrink: 0,
  },
  itemName: {
    fontSize: 15,
    fontWeight: 800,
    color: '#F1EFEA',
  },
  itemSubtitle: {
    fontSize: 12,
    color: '#9D9C9A',
    marginTop: 2,
  },
  verifiedBadge: {
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 800,
    padding: '2px 8px',
    borderRadius: 999,
    border: '1.5px solid',
    letterSpacing: 0.4,
  },
  radioIndicator: {
    width: 22,
    height: 22,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioSelected: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    backgroundColor: '#F0C23A',
    border: '3px solid #1B1E23',
    boxShadow: '0 0 0 2px #F0C23A',
  },
  radioUnselected: {
    width: 16,
    height: 16,
    borderRadius: '50%',
    border: '2px solid #3A3F47',
  },
  cacheNote: {
    marginTop: 12,
    marginBottom: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: '#9D9C9A',
  },
  actionRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  btnPrimary: {
    width: '100%',
    padding: '13px 18px',
    backgroundColor: '#F0C23A',
    color: '#111316',
    border: 'none',
    borderRadius: 14,
    fontSize: 15,
    fontWeight: 900,
    cursor: 'pointer',
    boxShadow: '0 3px 12px rgba(240, 194, 58, 0.25)',
  },
  btnSecondary: {
    width: '100%',
    padding: '12px 18px',
    backgroundColor: '#1B1E23',
    color: '#F1EFEA',
    border: '1.5px solid #2A2E35',
    borderRadius: 14,
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
  },
};

