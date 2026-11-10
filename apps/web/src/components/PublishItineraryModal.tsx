import { useState, useMemo } from 'react';
import {
  PublicItinerarySettings,
  DEFAULT_PUBLISH_SETTINGS,
  publishTrip,
  unpublishTrip,
  isTripPublished,
  getPublishedTripBySourceId,
  PublishedTrip,
} from '../utils/publicItinerary';

interface StopItem {
  id?: string;
  place: string;
  item_type?: string;
  description?: string;
  day_number?: number;
  order_index?: number;
  lat?: number | null;
  lng?: number | null;
  tips?: string;
}

interface PublishItineraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: {
    id: string;
    title: string;
    from_place: string;
    to_place: string;
    days: number;
    bike_type?: string;
    preferences?: string;
  };
  stops: StopItem[];
  user: {
    id: string;
    fullName: string;
  } | null;
  onPublishedSuccess?: (published: PublishedTrip) => void;
  onUnpublishedSuccess?: () => void;
}

export default function PublishItineraryModal({
  isOpen,
  onClose,
  trip,
  stops,
  user,
  onPublishedSuccess,
  onUnpublishedSuccess,
}: PublishItineraryModalProps) {
  const [activeTab, setActiveTab] = useState<'settings' | 'preview'>('settings');
  const [settings, setSettings] = useState<PublicItinerarySettings>(() => {
    const existing = getPublishedTripBySourceId(trip.id);
    return existing ? { ...existing.settings } : { ...DEFAULT_PUBLISH_SETTINGS };
  });

  const [tagInput, setTagInput] = useState<string>('TWISTY, GHATS');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentlyPublished = isTripPublished(trip.id);

  // Toggle a stop private/public
  const toggleStopPrivacy = (stopId: string) => {
    setSettings((prev) => {
      const isHidden = prev.hiddenStopIds.includes(stopId);
      return {
        ...prev,
        hiddenStopIds: isHidden
          ? prev.hiddenStopIds.filter((id) => id !== stopId)
          : [...prev.hiddenStopIds, stopId],
      };
    });
  };

  // Compute what stops will actually be visible in the public view
  const previewStops = useMemo(() => {
    return stops.filter((stop, idx) => {
      const stopId = stop.id || `stop-${idx}`;
      if (settings.hiddenStopIds.includes(stopId)) return false;
      if (settings.hideHotels && (stop.item_type === 'stay' || /hotel|resort|lodge|stay/i.test(stop.place))) {
        return false;
      }
      return true;
    }).map((stop, idx) => {
      const isStart = (stop.day_number === 1 && (stop.order_index === 0 || stop.order_index === 1)) ||
        (stop.place.toLowerCase().includes(trip.from_place.toLowerCase()) && idx === 0);

      if (isStart && settings.hideHomeStart) {
        return {
          ...stop,
          place: `${trip.from_place} (General Departure Area)`,
          lat: null,
          lng: null,
          description: settings.includeNotes ? stop.description : undefined,
        };
      }
      return {
        ...stop,
        description: settings.includeNotes ? stop.description : undefined,
      };
    });
  }, [stops, settings, trip.from_place]);

  const hiddenCount = stops.length - previewStops.length;

  const handlePublish = () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const tags = tagInput
        .split(',')
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean);

      const published = publishTrip({
        trip,
        stops,
        settings,
        author: {
          id: user.id,
          fullName: user.fullName || 'Convoy Leader',
        },
        tags,
      });

      onPublishedSuccess?.(published);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnpublish = () => {
    unpublishTrip(trip.id);
    onUnpublishedSuccess?.();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>🌐</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={styles.title}>Publish Itinerary Publicly</h3>
                {currentlyPublished && (
                  <span style={styles.liveBadge}>LIVE IN DISCOVER</span>
                )}
              </div>
              <p style={styles.subtitle}>Feature 1B · Share with riders and let the community discover & copy your route</p>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn} title="Close">✕</button>
        </div>

        {/* Tab Switcher: Settings vs Preview */}
        <div style={styles.tabBar}>
          <button
            onClick={() => setActiveTab('settings')}
            style={activeTab === 'settings' ? styles.tabActive : styles.tabInactive}
          >
            <span>⚙️ 1. Choose What's Public</span>
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            style={activeTab === 'preview' ? styles.tabActive : styles.tabInactive}
          >
            <span>👁️ 2. Preview Before Publishing</span>
          </button>
        </div>

        {/* Body Content */}
        <div style={styles.body}>
          {activeTab === 'settings' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Privacy Shield Highlight (Rule 2) */}
              <div style={styles.privacyShieldCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>🛡️</span>
                  <span style={{ fontWeight: 800, fontSize: 13, color: '#10B981' }}>
                    PRIVACY PROTECTIONS ACTIVE
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#F1EFEA', marginTop: 4, lineHeight: 1.4 }}>
                  <strong>Home start points are never shown</strong> to protect rider residential addresses.
                  Hotels and specific sensitive stops can also be masked.
                </div>
              </div>

              {/* Step 1: Content toggles */}
              <div>
                <h4 style={styles.sectionHeading}>1. SELECT INCLUDED SECTIONS</h4>
                <div style={styles.toggleGrid}>
                  <label style={styles.toggleRow}>
                    <input
                      type="checkbox"
                      checked={settings.includeRoute}
                      onChange={(e) => setSettings({ ...settings, includeRoute: e.target.checked })}
                      style={styles.checkbox}
                    />
                    <div>
                      <div style={styles.toggleTitle}>🗺️ Route & Coordinates</div>
                      <div style={styles.toggleDesc}>Waypoints, distance, and highway trace</div>
                    </div>
                  </label>

                  <label style={styles.toggleRow}>
                    <input
                      type="checkbox"
                      checked={settings.includeDays}
                      onChange={(e) => setSettings({ ...settings, includeDays: e.target.checked })}
                      style={styles.checkbox}
                    />
                    <div>
                      <div style={styles.toggleTitle}>📅 Days & Schedule</div>
                      <div style={styles.toggleDesc}>Multi-day plan breakdown ({trip.days} days)</div>
                    </div>
                  </label>

                  <label style={styles.toggleRow}>
                    <input
                      type="checkbox"
                      checked={settings.includeStops}
                      onChange={(e) => setSettings({ ...settings, includeStops: e.target.checked })}
                      style={styles.checkbox}
                    />
                    <div>
                      <div style={styles.toggleTitle}>📍 Stops & Verified Waypoints</div>
                      <div style={styles.toggleDesc}>Fuel stations, food joints, viewpoints</div>
                    </div>
                  </label>

                  <label style={styles.toggleRow}>
                    <input
                      type="checkbox"
                      checked={settings.includeNotes}
                      onChange={(e) => setSettings({ ...settings, includeNotes: e.target.checked })}
                      style={styles.checkbox}
                    />
                    <div>
                      <div style={styles.toggleTitle}>📝 Notes & Riding Tips</div>
                      <div style={styles.toggleDesc}>Road conditions, hairpin warnings, advice</div>
                    </div>
                  </label>

                  <label style={styles.toggleRow}>
                    <input
                      type="checkbox"
                      checked={settings.includePhotos}
                      onChange={(e) => setSettings({ ...settings, includePhotos: e.target.checked })}
                      style={styles.checkbox}
                    />
                    <div>
                      <div style={styles.toggleTitle}>📸 Photos & Scenery</div>
                      <div style={styles.toggleDesc}>Show route scenic photographs</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Step 2: Privacy Filters */}
              <div>
                <h4 style={styles.sectionHeading}>2. PRIVACY & SAFETY FILTERS</h4>
                <div style={styles.toggleGrid}>
                  <label style={{ ...styles.toggleRow, borderColor: '#10B981' }}>
                    <input
                      type="checkbox"
                      checked={settings.hideHomeStart}
                      onChange={(e) => setSettings({ ...settings, hideHomeStart: e.target.checked })}
                      style={styles.checkbox}
                    />
                    <div>
                      <div style={{ ...styles.toggleTitle, color: '#10B981' }}>
                        🔒 Hide Home / Starting Address
                      </div>
                      <div style={styles.toggleDesc}>
                        Start point is generalized to city name; exact GPS is omitted.
                      </div>
                    </div>
                  </label>

                  <label style={styles.toggleRow}>
                    <input
                      type="checkbox"
                      checked={settings.hideHotels}
                      onChange={(e) => setSettings({ ...settings, hideHotels: e.target.checked })}
                      style={styles.checkbox}
                    />
                    <div>
                      <div style={styles.toggleTitle}>🏨 Hide Hotel & Night Stays</div>
                      <div style={styles.toggleDesc}>Keep your private overnight accommodations hidden</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Individual stop checklist */}
              {stops.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h4 style={{ ...styles.sectionHeading, margin: 0 }}>
                      3. STOP PRIVACY (CLICK TO HIDE INDIVIDUAL STOPS)
                    </h4>
                    <span style={{ fontSize: 11, color: '#9D9C9A' }}>
                      {hiddenCount > 0 ? `🛡️ ${hiddenCount} stops hidden` : 'All stops visible'}
                    </span>
                  </div>

                  <div style={styles.stopsList}>
                    {stops.map((stop, idx) => {
                      const stopId = stop.id || `stop-${idx}`;
                      const isExplicitlyHidden = settings.hiddenStopIds.includes(stopId);
                      const isAutoHiddenHotel = settings.hideHotels && (stop.item_type === 'stay' || /hotel|resort|lodge/i.test(stop.place));
                      const isHidden = isExplicitlyHidden || isAutoHiddenHotel;

                      return (
                        <div
                          key={stopId}
                          onClick={() => toggleStopPrivacy(stopId)}
                          style={{
                            ...styles.stopItemRow,
                            opacity: isHidden ? 0.6 : 1,
                            borderColor: isHidden ? '#EF4444' : '#2A2E35',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 16 }}>
                              {stop.item_type === 'fuel_stop' ? '⛽' : stop.item_type === 'meal' ? '🍽️' : stop.item_type === 'stay' ? '🏨' : '📍'}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#F1EFEA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                Day {stop.day_number || 1} · {stop.place}
                              </div>
                              {stop.description && (
                                <div style={{ fontSize: 11, color: '#9D9C9A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {stop.description}
                                </div>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {isHidden ? (
                              <span style={styles.hiddenPill}>🔒 Private</span>
                            ) : (
                              <span style={styles.publicPill}>👁️ Public</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tags Input for Discover Search */}
              <div>
                <h4 style={styles.sectionHeading}>4. DISCOVER TAGS (COMMA SEPARATED)</h4>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="e.g. TWISTY, 3-5 DAYS, GHATS, SCENIC, COASTAL"
                  style={styles.textInput}
                />
                <div style={{ fontSize: 11, color: '#9D9C9A', marginTop: 4 }}>
                  Tags help other riders filter by riding style and terrain in Discover.
                </div>
              </div>
            </div>
          ) : (
            /* Step 3: Interactive Live Preview */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={styles.previewNotice}>
                <span>👁️</span>
                <span>
                  This is exactly how riders in <strong>Discover</strong> will view your published itinerary before copying it.
                </span>
              </div>

              {/* Public Card Mockup */}
              <div style={styles.previewCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#F1EFEA' }}>
                      {trip.title}
                    </h3>
                    <div style={{ fontSize: 12, color: '#F0C23A', fontWeight: 700, marginTop: 4 }}>
                      by {user?.fullName || 'You'} · New Release · 5.0 ★
                    </div>
                  </div>
                  <span style={styles.previewTag}>PUBLIC ITINERARY</span>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  {tagInput.split(',').map((t) => t.trim().toUpperCase()).filter(Boolean).map((tag) => (
                    <span key={tag} style={styles.chipTag}>{tag}</span>
                  ))}
                </div>

                {/* Privacy Badge */}
                <div style={styles.sanitizedSummaryBar}>
                  <span>🛡️</span>
                  <span>
                    Privacy verified: Home address masked · {previewStops.length} public stops included
                    {hiddenCount > 0 && ` (${hiddenCount} private stops omitted)`}
                  </span>
                </div>

                {/* Stops breakdown */}
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#9D9C9A', textTransform: 'uppercase', marginBottom: 8 }}>
                    Published Stops ({previewStops.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                    {previewStops.map((s, idx) => (
                      <div key={idx} style={styles.previewStopRow}>
                        <div style={styles.previewStopNumber}>{idx + 1}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#F1EFEA' }}>
                            {s.place}
                          </div>
                          {s.description && (
                            <div style={{ fontSize: 11, color: '#9D9C9A' }}>{s.description}</div>
                          )}
                        </div>
                        <span style={styles.previewStopType}>{s.item_type || 'stop'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Source attribution preview */}
                <div style={styles.previewAttributionNotice}>
                  <span>ℹ️ When riders tap <strong>"Copy to my trips"</strong>, they get an editable draft that credits you as the original source:</span>
                  <div style={{ marginTop: 4, fontStyle: 'italic', color: '#F0C23A' }}>
                    "Forked from @{user?.fullName || 'You'} ({trip.title})"
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div style={styles.footer}>
          {currentlyPublished && (
            <button
              onClick={handleUnpublish}
              style={styles.btnUnpublish}
              title="Remove from public Discover"
            >
              🚫 Unpublish
            </button>
          )}

          <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
            <button onClick={onClose} style={styles.btnCancel}>
              Cancel
            </button>

            {activeTab === 'settings' ? (
              <button
                onClick={() => setActiveTab('preview')}
                style={styles.btnPreview}
              >
                <span>👁️</span> Preview Public Page
              </button>
            ) : (
              <button
                onClick={handlePublish}
                disabled={isSubmitting}
                style={styles.btnPublishPrimary}
              >
                <span>🌐</span>
                {isSubmitting ? 'Publishing...' : currentlyPublished ? 'Update in Discover' : 'Publish to Discover'}
              </button>
            )}
          </div>
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
    maxWidth: 620,
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '20px 24px 14px',
    borderBottom: '1px solid #2A2E35',
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: '#F1EFEA',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  subtitle: {
    margin: '4px 0 0',
    fontSize: 12,
    color: '#9D9C9A',
  },
  liveBadge: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1,
    padding: '2px 8px',
    borderRadius: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    border: '1px solid #10B981',
    color: '#10B981',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#9D9C9A',
    fontSize: 18,
    cursor: 'pointer',
    padding: 4,
  },
  tabBar: {
    display: 'flex',
    borderBottom: '1px solid #2A2E35',
    backgroundColor: '#111316',
  },
  tabActive: {
    flex: 1,
    padding: '12px 16px',
    backgroundColor: '#1B1E23',
    border: 'none',
    borderBottom: '2.5px solid #F0C23A',
    color: '#F0C23A',
    fontWeight: 800,
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'center',
  },
  tabInactive: {
    flex: 1,
    padding: '12px 16px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#9D9C9A',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'center',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '18px 24px',
  },
  privacyShieldCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    border: '1.5px solid rgba(16, 185, 129, 0.4)',
    borderRadius: 14,
    padding: '12px 16px',
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 1.2,
    color: '#9D9C9A',
    textTransform: 'uppercase',
    margin: '0 0 10px',
  },
  toggleGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#111316',
    border: '1.5px solid #2A2E35',
    borderRadius: 12,
    padding: '10px 14px',
    cursor: 'pointer',
  },
  checkbox: {
    width: 18,
    height: 18,
    accentColor: '#F0C23A',
    cursor: 'pointer',
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: '#F1EFEA',
  },
  toggleDesc: {
    fontSize: 11,
    color: '#9D9C9A',
    marginTop: 2,
  },
  stopsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    maxHeight: 180,
    overflowY: 'auto',
    backgroundColor: '#111316',
    border: '1.5px solid #2A2E35',
    borderRadius: 12,
    padding: 8,
  },
  stopItemRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: '#1B1E23',
    border: '1px solid #2A2E35',
    borderRadius: 8,
    padding: '8px 12px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  publicPill: {
    fontSize: 10,
    fontWeight: 800,
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    padding: '2px 8px',
    borderRadius: 6,
  },
  hiddenPill: {
    fontSize: 10,
    fontWeight: 800,
    color: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: '2px 8px',
    borderRadius: 6,
  },
  textInput: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 10,
    border: '1.5px solid #2A2E35',
    backgroundColor: '#111316',
    color: '#F1EFEA',
    fontSize: 13,
    outline: 'none',
  },
  previewNotice: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(240, 194, 58, 0.1)',
    border: '1px solid rgba(240, 194, 58, 0.3)',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 12,
    color: '#F1EFEA',
  },
  previewCard: {
    backgroundColor: '#111316',
    border: '1.5px solid #2A2E35',
    borderRadius: 16,
    padding: 16,
  },
  previewTag: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1,
    padding: '3px 8px',
    borderRadius: 6,
    backgroundColor: 'rgba(240, 194, 58, 0.15)',
    color: '#F0C23A',
    border: '1px solid #F0C23A',
  },
  chipTag: {
    fontSize: 10,
    fontWeight: 800,
    padding: '2px 8px',
    borderRadius: 6,
    backgroundColor: '#1B1E23',
    border: '1px solid #2A2E35',
    color: '#9D9C9A',
  },
  sanitizedSummaryBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 11,
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    padding: '6px 10px',
    borderRadius: 8,
    marginTop: 12,
  },
  previewStopRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1B1E23',
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #2A2E35',
  },
  previewStopNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#2A2E35',
    color: '#F0C23A',
    fontSize: 11,
    fontWeight: 900,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewStopType: {
    fontSize: 10,
    fontWeight: 800,
    color: '#9D9C9A',
    backgroundColor: '#111316',
    padding: '2px 6px',
    borderRadius: 4,
    textTransform: 'uppercase',
  },
  previewAttributionNotice: {
    marginTop: 16,
    padding: '10px 12px',
    borderRadius: 10,
    backgroundColor: '#1B1E23',
    border: '1px dashed #2A2E35',
    fontSize: 11,
    color: '#9D9C9A',
    lineHeight: 1.4,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px 24px',
    borderTop: '1px solid #2A2E35',
    backgroundColor: '#1B1E23',
  },
  btnUnpublish: {
    padding: '9px 14px',
    backgroundColor: 'transparent',
    border: '1.5px solid #EF4444',
    borderRadius: 10,
    color: '#EF4444',
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
  },
  btnCancel: {
    padding: '9px 16px',
    backgroundColor: '#111316',
    border: '1.5px solid #2A2E35',
    borderRadius: 10,
    color: '#F1EFEA',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  btnPreview: {
    padding: '9px 18px',
    backgroundColor: '#111316',
    border: '1.5px solid #F0C23A',
    borderRadius: 10,
    color: '#F0C23A',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  btnPublishPrimary: {
    padding: '9px 20px',
    backgroundColor: '#F0C23A',
    border: 'none',
    borderRadius: 10,
    color: '#111316',
    fontSize: 13,
    fontWeight: 900,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
};
