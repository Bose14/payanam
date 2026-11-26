import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatVerifiedAge } from '../utils/lastSeen';
import {
  NearbyServiceItem,
  getCachedNearbyServices,
  confirmServiceOpen,
  reportServiceClosed,
  sortServicesByDistance,
} from '../utils/nearbyServices';
import AddNearbyServiceModal from './AddNearbyServiceModal';
import Icon from './Icon';

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
    showToast(`Confirmed "${name}" is open! Verified timestamp updated.`);
  };

  const handleReportClosed = (id: string, name: string) => {
    const updated = reportServiceClosed(id, userName);
    setServices(updated);
    showToast(`Reported "${name}" as closed. Alerting convoy riders.`);
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

  const nice = (label: string) => {
    const t = label.replace(/^VERIFIED\s*/i, '').toLowerCase();
    if (label === 'UNVERIFIED') return 'Not verified yet';
    return `Verified ${t}`;
  };
  const catColor = (c: string) =>
    c === 'FUEL' ? '#D97706' : c === 'REPAIR' ? '#2563EB' : c === 'FOOD' ? '#EA580C' : c === 'STAY' ? '#059669' : '#7C3AED';
  const catIcon = (c: string) =>
    c === 'FUEL' ? 'fuel' : c === 'REPAIR' ? 'wrench' : c === 'FOOD' ? 'food' : c === 'STAY' ? 'bed' : c === 'REST' ? 'coffee' : 'star';
  const catLabel = (c: string) => c.charAt(0) + c.slice(1).toLowerCase();

  return createPortal(
    <>
      <div style={styles.overlay} onClick={onClose}>
        <div style={styles.sheet} role="dialog" aria-label="Nearby help" onClick={(e) => e.stopPropagation()}>
          <div style={styles.handleWrap}><div style={styles.handle} /></div>

          <div style={styles.headerRow}>
            <div style={{ minWidth: 0 }}>
              <h2 style={styles.title}>Nearby help</h2>
              <p style={styles.subtitle}>Fuel, repair, food, rest and stays along your route</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button type="button" onClick={() => setShowAddModal(true)} style={styles.roundBtn} aria-label="Add a place" title="Add a place">
                <Icon name="plus" />
              </button>
              <button type="button" onClick={onClose} style={styles.roundBtn} aria-label="Close" title="Close">
                <Icon name="close" />
              </button>
            </div>
          </div>

          {toastMessage && <div style={styles.toastBar}>{toastMessage}</div>}

          <div style={styles.filterRow}>
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat;
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
                    backgroundColor: isActive ? 'var(--pz-accent)' : 'var(--pz-surface)',
                    color: isActive ? 'var(--pz-on-accent)' : 'var(--pz-ink)',
                    borderColor: isActive ? 'var(--pz-accent)' : 'var(--pz-line)',
                  }}
                >
                  <Icon name={catIcon(cat)} />
                  <span>{cat === 'ALL' ? 'All' : catLabel(cat)}</span>
                </button>
              );
            })}
          </div>

          <div style={styles.listingsScroll}>
            {filteredItems.length === 0 ? (
              <div style={styles.emptyCard}>
                <div style={{ fontSize: 26, marginBottom: 6, color: 'var(--pz-muted)' }}><Icon name="pin" /></div>
                <div style={{ color: 'var(--pz-ink)', fontWeight: 800, fontSize: 14 }}>
                  No {activeCategory === 'ALL' ? '' : catLabel(activeCategory) + ' '}places listed yet
                </div>
                <button onClick={() => setShowAddModal(true)} style={styles.btnEmptyAdd}>Add a place</button>
              </div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = item.id === selectedItem?.id;
                const verifiedLabel = formatVerifiedAge(item.verifiedAt);
                const isOld = verifiedLabel.includes('MONTH') || verifiedLabel.includes('YEAR') || verifiedLabel === 'UNVERIFIED';
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    style={{
                      ...styles.itemCard,
                      borderColor: isSelected ? 'var(--pz-accent)' : 'var(--pz-line)',
                      backgroundColor: isSelected ? 'var(--pz-warn-bg)' : 'var(--pz-surface)',
                      opacity: item.isOpen ? 1 : 0.8,
                    }}
                  >
                    <div style={{ ...styles.itemCategoryBadge, backgroundColor: catColor(item.category) }}>
                      <Icon name={catIcon(item.category)} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.itemTop}>
                        <div style={styles.itemName}>{item.name}</div>
                        <span style={item.isOpen ? styles.openBadge : styles.closedBadge}>{item.isOpen ? 'Open' : 'Closed'}</span>
                      </div>
                      <div style={styles.itemSubtitle}>{item.subtitle}</div>
                      <div style={styles.metaLine}>
                        <b style={{ color: 'var(--pz-ink)' }}>{item.distanceKm} km</b>
                        <span aria-hidden="true">·</span>
                        <span style={{ color: isOld ? 'var(--pz-muted)' : 'var(--pz-ok)', fontWeight: 700 }}>{nice(verifiedLabel)}</span>
                        {item.source && (<><span aria-hidden="true">·</span><span>{item.source}</span></>)}
                      </div>

                      {isSelected && (
                        <div style={styles.itemActionsBar}>
                          {item.phone && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleCall(item.phone); }} style={styles.actionBtnSmall}>
                              <Icon name="phone" /> Call
                            </button>
                          )}
                          <button type="button" onClick={(e) => { e.stopPropagation(); handleConfirmOpen(item.id, item.name); }} style={{ ...styles.actionBtnSmall, color: 'var(--pz-ok)' }}>
                            <Icon name="check" /> Still open
                          </button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); handleReportClosed(item.id, item.name); }} style={{ ...styles.actionBtnSmall, color: 'var(--pz-bad)' }}>
                            <Icon name="warning" /> Closed
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div style={styles.cacheNote}>
            <Icon name="download" />
            <span>Saved on your phone, works without signal</span>
          </div>

          {selectedItem && (
            <div style={styles.actionRow}>
              <button type="button" onClick={() => handleNavigateClick(selectedItem)} style={styles.btnPrimary}>
                <Icon name="compass" /> Navigate
              </button>
              {onPinAsStop && (
                <button type="button" onClick={() => handlePinClick(selectedItem)} style={styles.btnSecondary}>
                  <Icon name="pin" /> Add as stop
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <AddNearbyServiceModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        currentGps={currentGps}
        userName={userName}
        onPlaceAdded={(added) => {
          setServices((prev) => [added, ...prev]);
          setSelectedId(added.id);
          showToast(`Added "${added.name}" to route corridor!`);
        }}
      />
    </>,
    document.body,
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)',
    zIndex: 100000, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', animation: 'fadeIn 0.2s ease-out',
  },
  sheet: {
    backgroundColor: 'var(--pz-surface)', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTop: '1px solid var(--pz-line)',
    maxHeight: '88dvh', display: 'flex', flexDirection: 'column', boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.35)', overflow: 'hidden',
    color: 'var(--pz-ink)',
  },
  handleWrap: { display: 'flex', justifyContent: 'center', padding: '10px 0 2px' },
  handle: { width: 36, height: 4, backgroundColor: 'var(--pz-line)', borderRadius: 2 },
  headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 16px 12px' },
  title: { margin: 0, fontSize: 20, fontWeight: 900, color: 'var(--pz-ink)' },
  subtitle: { margin: '2px 0 0', fontSize: 12, color: 'var(--pz-muted)', lineHeight: 1.3 },
  roundBtn: {
    width: 40, height: 40, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    backgroundColor: 'var(--pz-bg)', border: '1px solid var(--pz-line)', color: 'var(--pz-ink)', fontSize: 18,
  },
  toastBar: { backgroundColor: 'var(--pz-ok)', color: 'var(--pz-on-ok)', padding: '8px 16px', fontSize: 12, fontWeight: 800, textAlign: 'center' },
  filterRow: { display: 'flex', gap: 8, padding: '0 16px 12px', overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'none' },
  filterPill: {
    padding: '8px 14px', borderRadius: 999, fontSize: 13, fontWeight: 800, cursor: 'pointer', border: '1px solid',
    whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
  },
  listingsScroll: {
    flex: 1, overflowY: 'auto', padding: '4px 16px 12px', display: 'flex', flexDirection: 'column', gap: 10,
    borderTop: '1px solid var(--pz-line)', paddingTop: 12, backgroundColor: 'var(--pz-bg)',
  },
  emptyCard: { textAlign: 'center', padding: '28px 16px', backgroundColor: 'var(--pz-surface)', borderRadius: 14, border: '1px dashed var(--pz-line)' },
  btnEmptyAdd: {
    marginTop: 12, padding: '9px 18px', backgroundColor: 'var(--pz-accent)', color: 'var(--pz-on-accent)',
    border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer',
  },
  itemCard: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px', borderRadius: 14, border: '1.5px solid', cursor: 'pointer' },
  itemCategoryBadge: {
    width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, flexShrink: 0, color: '#fff',
  },
  itemTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  itemName: { fontSize: 15, fontWeight: 800, color: 'var(--pz-ink)', lineHeight: 1.25, minWidth: 0, overflowWrap: 'anywhere' },
  itemSubtitle: { fontSize: 13, color: 'var(--pz-muted)', marginTop: 2, lineHeight: 1.35 },
  openBadge: {
    fontSize: 11, fontWeight: 800, color: 'var(--pz-ok)', backgroundColor: 'var(--pz-ok-bg)', padding: '2px 8px', borderRadius: 999, flexShrink: 0,
  },
  closedBadge: {
    fontSize: 11, fontWeight: 800, color: 'var(--pz-bad)', backgroundColor: 'var(--pz-bad-bg)', padding: '2px 8px', borderRadius: 999, flexShrink: 0,
  },
  metaLine: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 6, fontSize: 12, color: 'var(--pz-muted)' },
  itemActionsBar: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  actionBtnSmall: {
    padding: '7px 12px', backgroundColor: 'var(--pz-surface)', border: '1px solid var(--pz-line)', borderRadius: 10,
    color: 'var(--pz-ink)', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
  },
  cacheNote: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 16px',
    borderTop: '1px solid var(--pz-line)', fontSize: 12, color: 'var(--pz-muted)',
  },
  actionRow: {
    display: 'flex', gap: 10, padding: '10px 16px max(14px, env(safe-area-inset-bottom, 14px))',
    borderTop: '1px solid var(--pz-line)', backgroundColor: 'var(--pz-surface)',
  },
  btnPrimary: {
    flex: 1.4, padding: '13px 14px', backgroundColor: 'var(--pz-accent)', color: 'var(--pz-on-accent)', border: 'none',
    borderRadius: 12, fontWeight: 900, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnSecondary: {
    flex: 1, padding: '13px 14px', backgroundColor: 'var(--pz-bg)', color: 'var(--pz-ink)', border: '1.5px solid var(--pz-line)',
    borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
};
