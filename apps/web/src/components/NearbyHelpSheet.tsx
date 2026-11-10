import React, { useState, useMemo, useEffect } from 'react';
import { formatVerifiedAge } from '../utils/lastSeen';
import {
  NearbyServiceItem,
  getCachedNearbyServices,
  confirmServiceOpen,
  reportServiceClosed,
  sortServicesByDistance,
} from '../utils/nearbyServices';
import AddNearbyServiceModal from './AddNearbyServiceModal';

export type NearbyCategory = 'ALL' | 'FUEL' | 'REPAIR' | 'FOOD' | 'REST' | 'STAY';

export interface NearbyPlaceItem {
  id: string;
  category: 'FUEL' | 'REPAIR' | 'FOOD' | 'REST' | 'STAY';
  name: string;
  subtitle: string;
  distanceKm: number;
  verifiedAt: string;
  source?: string;
  phone?: string;
  isOpen?: boolean;
  lat: number;
  lng: number;
  notes?: string;
}

interface NearbyHelpSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentGps?: { lat: number; lng: number } | null;
  userName?: string;
  onNavigate?: (target: { name: string; lat: number; lng: number }) => void;
  onPinAsStop?: (item: { name: string; lat: number; lng: number; type: string }) => void;
}

export const NearbyHelpSheet: React.FC<NearbyHelpSheetProps> = ({
  isOpen,
  onClose,
  currentGps,
  userName,
  onNavigate,
  onPinAsStop,
}) => {
  const [activeCategory, setActiveCategory] = useState<NearbyCategory>('FUEL');
  const [selectedId, setSelectedId] = useState<string>('');
  const [services, setServices] = useState<NearbyServiceItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load from offline cache
  useEffect(() => {
    const cached = getCachedNearbyServices();
    setServices(cached);
    if (cached.length > 0 && !selectedId) {
      setSelectedId(cached[0].id);
    }
  }, [isOpen, selectedId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Step 1 & 3: Route corridor sorted by distance
  const sortedServices = useMemo(() => {
    return sortServicesByDistance(services, currentGps?.lat, currentGps?.lng);
  }, [services, currentGps]);

  // Step 2: Filter chosen (Fuel, Repair, Food, Rest, Stay)
  const filteredItems = useMemo(() => {
    if (activeCategory === 'ALL') return sortedServices;
    return sortedServices.filter((s) => s.category === activeCategory);
  }, [sortedServices, activeCategory]);

  const selectedItem = useMemo(() => {
    return sortedServices.find((i) => i.id === selectedId) || filteredItems[0] || null;
  }, [sortedServices, selectedId, filteredItems]);

  if (!isOpen) return null;

  // Step 4 Actions
  const handleNavigateClick = (item?: NearbyServiceItem | null) => {
    const target = item || selectedItem;
    if (!target) return;
    if (onNavigate) {
      onNavigate({
        name: target.name,
        lat: target.lat,
        lng: target.lng,
      });
    }
    onClose();
  };

  const handleCall = (phone?: string) => {
    if (!phone) return;
    window.open(`tel:${phone}`, '_self');
  };

  const handleConfirmOpen = (id: string, name: string) => {
    const updated = confirmServiceOpen(id, userName);
    setServices(updated);
    showToast(`✓ Confirmed "${name}" is open! Verified timestamp updated.`);
  };

  const handleReportClosed = (id: string, name: string) => {
    const updated = reportServiceClosed(id, userName);
    setServices(updated);
    showToast(`⚠️ Reported "${name}" as closed. Alerting convoy riders.`);
  };

  const handlePinClick = (item?: NearbyServiceItem | null) => {
    const target = item || selectedItem;
    if (!target) return;
    if (onPinAsStop) {
      onPinAsStop({
        name: target.name,
        lat: target.lat,
        lng: target.lng,
        type:
          target.category === 'FUEL'
            ? 'fuel_stop'
            : target.category === 'FOOD'
            ? 'meal'
            : target.category === 'REPAIR'
            ? 'stop'
            : target.category === 'STAY'
            ? 'stay'
            : 'rest',
      });
    }
    onClose();
  };

  const CATEGORIES: NearbyCategory[] = ['ALL', 'FUEL', 'REPAIR', 'FOOD', 'REST', 'STAY'];

  return (
    <>
      <div style={styles.overlay} onClick={onClose}>
        <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
          {/* Handle */}
          <div style={styles.handleWrap} onClick={onClose}>
            <div style={styles.handle} />
          </div>

          {/* Header with Title and '+ Add a Place' action */}
          <div style={styles.headerRow}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={styles.title}>Nearby services</h2>
                <span style={styles.alongRouteBadge}>Route Corridor</span>
              </div>
              <p style={styles.subtitle}>Feature 3 · Verified fuel, breakdown repair, food, rest & stays</p>
            </div>

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              style={styles.btnAddPlace}
              title="Add a place along route"
            >
              <span>+</span> Add place
            </button>
          </div>

          {/* Toast Notification */}
          {toastMessage && (
            <div style={styles.toastBar}>
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Step 2: Filter Pills (Fuel, Repair, Food, Rest, Stay) */}
          <div style={styles.filterRow}>
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat;
              const icon = cat === 'FUEL' ? '⛽' : cat === 'REPAIR' ? '🔧' : cat === 'FOOD' ? '🍽️' : cat === 'REST' ? '☕' : cat === 'STAY' ? '🏨' : '🌟';
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setActiveCategory(cat);
                    const firstInCat = sortedServices.find((i) => cat === 'ALL' || i.category === cat);
                    if (firstInCat) setSelectedId(firstInCat.id);
                  }}
                  style={{
                    ...styles.filterPill,
                    backgroundColor: isActive ? '#F0C23A' : '#111316',
                    color: isActive ? '#111316' : '#9D9C9A',
                    borderColor: isActive ? '#F0C23A' : '#2A2E35',
                  }}
                >
                  <span>{icon}</span>
                  <span>{cat}</span>
                </button>
              );
            })}
          </div>

          {/* Step 3: Listings Sorted By Distance */}
          <div style={styles.listingsScroll}>
            {filteredItems.length === 0 ? (
              <div style={styles.emptyCard}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>📍</div>
                <div style={{ color: '#F1EFEA', fontWeight: 800, fontSize: 13 }}>
                  No {activeCategory} services found near this corridor
                </div>
                <button
                  onClick={() => setShowAddModal(true)}
                  style={styles.btnEmptyAdd}
                >
                  + Add the first {activeCategory} service
                </button>
              </div>
            ) : (
              filteredItems.map((item) => {
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
                      opacity: item.isOpen ? 1 : 0.75,
                    }}
                  >
                    {/* Category icon */}
                    <div style={{
                      ...styles.itemCategoryBadge,
                      backgroundColor: item.category === 'FUEL' ? '#D97706' : item.category === 'REPAIR' ? '#2563EB' : item.category === 'FOOD' ? '#EA580C' : item.category === 'STAY' ? '#059669' : '#7C3AED',
                    }}>
                      {item.category === 'FUEL' ? '⛽' : item.category === 'REPAIR' ? '🔧' : item.category === 'FOOD' ? '🍽️' : item.category === 'STAY' ? '🏨' : '☕'}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <div style={styles.itemName}>{item.name}</div>
                        {/* Status badge */}
                        {item.isOpen ? (
                          <span style={styles.openBadge}>🟢 OPEN</span>
                        ) : (
                          <span style={styles.closedBadge}>⚠️ CLOSED</span>
                        )}
                      </div>

                      <div style={styles.itemSubtitle}>{item.subtitle}</div>

                      {/* Distance and Source + Last-Verified Stamp (Step 3) */}
                      <div style={styles.metaRow}>
                        <span style={styles.distanceBadge}>
                          📍 {item.distanceKm} km away
                        </span>

                        <span
                          style={{
                            ...styles.verifiedBadge,
                            color: isOld ? '#9D9C9A' : '#10B981',
                            backgroundColor: isOld ? 'rgba(157, 156, 154, 0.12)' : 'rgba(16, 185, 129, 0.15)',
                            borderColor: isOld ? '#2A2E35' : '#10B981',
                          }}
                        >
                          Verified: {verifiedLabel}
                        </span>

                        {item.source && (
                          <span style={styles.sourceBadge}>
                            Source: {item.source}
                          </span>
                        )}
                      </div>

                      {/* Step 4: Rider action buttons for this item */}
                      <div style={styles.itemActionsBar}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNavigateClick(item);
                          }}
                          style={styles.actionBtnSmall}
                          title="Navigate using external maps"
                        >
                          <span>🧭</span> Navigate
                        </button>

                        {item.phone && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCall(item.phone);
                            }}
                            style={styles.actionBtnSmall}
                            title="Call ahead"
                          >
                            <span>📞</span> Call
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConfirmOpen(item.id, item.name);
                          }}
                          style={{ ...styles.actionBtnSmall, color: '#10B981' }}
                          title="Confirm open for convoy"
                        >
                          <span>✓</span> Confirm open
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReportClosed(item.id, item.name);
                          }}
                          style={{ ...styles.actionBtnSmall, color: '#EF4444' }}
                          title="Report closed"
                        >
                          <span>⚠️</span> Report closed
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Step 5: Offline cache note */}
          <div style={styles.cacheNote}>
            <span style={{ fontSize: 13 }}>💾</span>
            <span>Route corridor listings are cached before the ride. Fully accessible offline without signal.</span>
          </div>

          {/* Action Footer for Selected Item */}
          {selectedItem && (
            <div style={styles.actionRow}>
              <button
                type="button"
                onClick={() => handleNavigateClick(selectedItem)}
                style={styles.btnPrimary}
              >
                🧭 Navigate to {selectedItem.name.slice(0, 18)}
              </button>
              {onPinAsStop && (
                <button
                  type="button"
                  onClick={() => handlePinClick(selectedItem)}
                  style={styles.btnSecondary}
                >
                  📌 Pin as itinerary stop
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Place Modal */}
      <AddNearbyServiceModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        currentGps={currentGps}
        userName={userName}
        onPlaceAdded={(added) => {
          setServices((prev) => [added, ...prev]);
          setSelectedId(added.id);
          showToast(`✓ Added "${added.name}" to route corridor!`);
        }}
      />
    </>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    backdropFilter: 'blur(6px)',
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
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.7)',
    overflow: 'hidden',
  },
  handleWrap: {
    display: 'flex',
    justifyContent: 'center',
    padding: '10px 0 4px',
    cursor: 'pointer',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#3A3F4A',
    borderRadius: 2,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 14px 10px',
    borderBottom: '1px solid #2A2E35',
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: '#F1EFEA',
  },
  subtitle: {
    margin: '2px 0 0',
    fontSize: 11,
    color: '#9D9C9A',
  },
  alongRouteBadge: {
    fontSize: 10,
    fontWeight: 800,
    color: '#F0C23A',
    backgroundColor: 'rgba(240, 194, 58, 0.15)',
    border: '1px solid #F0C23A',
    padding: '2px 8px',
    borderRadius: 6,
    letterSpacing: 0.5,
  },
  btnAddPlace: {
    padding: '7px 12px',
    backgroundColor: '#111316',
    border: '1.5px solid #F0C23A',
    borderRadius: 10,
    color: '#F0C23A',
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  toastBar: {
    backgroundColor: '#10B981',
    color: '#111316',
    padding: '6px 16px',
    fontSize: 11,
    fontWeight: 900,
    textAlign: 'center',
  },
  filterRow: {
    display: 'flex',
    gap: 8,
    padding: '8px 14px',
    borderBottom: '1px solid #2A2E35',
    backgroundColor: '#111316',
    overflowX: 'auto',
  },
  filterPill: {
    padding: '6px 12px',
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 800,
    cursor: 'pointer',
    border: '1px solid',
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    transition: 'all 0.15s ease',
  },
  listingsScroll: {
    flex: 1,
    overflowY: 'auto',
    padding: '10px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  emptyCard: {
    textAlign: 'center',
    padding: '30px 16px',
    backgroundColor: '#111316',
    borderRadius: 14,
    border: '1px dashed #2A2E35',
  },
  btnEmptyAdd: {
    marginTop: 10,
    padding: '6px 14px',
    backgroundColor: '#F0C23A',
    color: '#111316',
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
  },
  itemCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '12px 14px',
    borderRadius: 14,
    border: '1.5px solid',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  itemCategoryBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    flexShrink: 0,
    boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
  },
  itemName: {
    fontSize: 14,
    fontWeight: 800,
    color: '#F1EFEA',
  },
  itemSubtitle: {
    fontSize: 12,
    color: '#9D9C9A',
    marginTop: 2,
    lineHeight: 1.35,
  },
  openBadge: {
    fontSize: 9,
    fontWeight: 900,
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    padding: '1px 6px',
    borderRadius: 4,
  },
  closedBadge: {
    fontSize: 9,
    fontWeight: 900,
    color: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: '1px 6px',
    borderRadius: 4,
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 6,
  },
  distanceBadge: {
    fontSize: 10,
    fontWeight: 800,
    color: '#F0C23A',
    backgroundColor: '#111316',
    border: '1px solid #2A2E35',
    padding: '2px 6px',
    borderRadius: 4,
  },
  verifiedBadge: {
    fontSize: 9,
    fontWeight: 800,
    padding: '2px 6px',
    borderRadius: 4,
    border: '1px solid',
    letterSpacing: 0.3,
  },
  sourceBadge: {
    fontSize: 9,
    color: '#9D9C9A',
    backgroundColor: '#111316',
    padding: '2px 6px',
    borderRadius: 4,
    border: '1px solid #2A2E35',
  },
  itemActionsBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  actionBtnSmall: {
    padding: '3px 8px',
    backgroundColor: '#111316',
    border: '1px solid #2A2E35',
    borderRadius: 6,
    color: '#F1EFEA',
    fontSize: 10,
    fontWeight: 800,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 3,
  },
  cacheNote: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px',
    backgroundColor: '#111316',
    borderTop: '1px solid #2A2E35',
    fontSize: 11,
    color: '#9D9C9A',
  },
  actionRow: {
    display: 'flex',
    gap: 10,
    padding: '10px 14px max(14px, env(safe-area-inset-bottom, 14px))',
    borderTop: '1px solid #2A2E35',
    backgroundColor: '#1B1E23',
    flexWrap: 'wrap',
  },
  btnPrimary: {
    flex: 1.5,
    minWidth: 160,
    padding: '10px 14px',
    backgroundColor: '#F0C23A',
    color: '#111316',
    border: 'none',
    borderRadius: 10,
    fontWeight: 900,
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'center',
  },
  btnSecondary: {
    flex: 1,
    minWidth: 140,
    padding: '10px 14px',
    backgroundColor: '#111316',
    color: '#F1EFEA',
    border: '1.5px solid #2A2E35',
    borderRadius: 10,
    fontWeight: 800,
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'center',
  },
};
