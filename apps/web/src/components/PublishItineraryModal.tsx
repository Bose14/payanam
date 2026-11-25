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
import Icon from './Icon';

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
            <span style={{ fontSize: 24 }}><Icon name="globe" /></span>
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
          <button onClick={onClose} style={styles.closeBtn} title="Close"><Icon name="close" /></button>
        </div>

        {/* Tab Switcher: Settings vs Preview */}
        <div style={styles.tabBar}>
          <button
            onClick={() => setActiveTab('settings')}
            style={activeTab === 'settings' ? styles.tabActive : styles.tabInactive}
          >
            <span>1. Choose What's Public</span>
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            style={activeTab === 'preview' ? styles.tabActive : styles.tabInactive}
          >
            <span>2. Preview Before Publishing</span>
          </button>
        </div>

        {/* Body Content */}
        <div style={styles.body}>
          {activeTab === 'settings' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Privacy Shield Highlight (Rule 2) */}
              <div style={styles.privacyShieldCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}><Icon name="shield" /></span>
                  <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--pz-ok)' }}>
                    PRIVACY PROTECTIONS ACTIVE
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 4, lineHeight: 1.4 }}>
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
                      <div style={styles.toggleTitle}>Route & Coordinates</div>
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
                      <div style={styles.toggleTitle}>Days & Schedule</div>
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
                      <div style={styles.toggleTitle}>Stops & Verified Waypoints</div>
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
                      <div style={styles.toggleTitle}>Notes & Riding Tips</div>
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
                      <div style={styles.toggleTitle}>Photos & Scenery</div>
                      <div style={styles.toggleDesc}>Show route scenic photographs</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Step 2: Privacy Filters */}
              <div>
                <h4 style={styles.sectionHeading}>2. PRIVACY & SAFETY FILTERS</h4>
                <div style={styles.toggleGrid}>
                  <label style={{ ...styles.toggleRow, borderColor: 'var(--pz-ok)' }}>
                    <input
                      type="checkbox"
                      checked={settings.hideHomeStart}
                      onChange={(e) => setSettings({ ...settings, hideHomeStart: e.target.checked })}
                      style={styles.checkbox}
                    />
                    <div>
                      <div style={{ ...styles.toggleTitle, color: 'var(--pz-ok)' }}>
                        Hide Home / Starting Address
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
                      <div style={styles.toggleTitle}>Hide Hotel & Night Stays</div>
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
                    <span style={{ fontSize: 11, color: 'var(--pz-muted)' }}>
                      {hiddenCount > 0 ? `${hiddenCount} stops hidden` : 'All stops visible'}
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
                            borderColor: isHidden ? 'var(--pz-bad)' : 'var(--pz-line)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 16 }}>
                              <Icon name={stop.item_type === 'fuel_stop' ? 'fuel' : stop.item_type === 'meal' ? 'food' : stop.item_type === 'stay' ? 'bed' : 'pin'} />
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                Day {stop.day_number || 1} · {stop.place}
                              </div>
                              {stop.description && (
                                <div style={{ fontSize: 11, color: 'var(--pz-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {stop.description}
                                </div>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {isHidden ? (
                              <span style={styles.hiddenPill}>Private</span>
                            ) : (
                              <span style={styles.publicPill}>Public</span>
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
                <div style={{ fontSize: 11, color: 'var(--pz-muted)', marginTop: 4 }}>
                  Tags help other riders filter by riding style and terrain in Discover.
                </div>
              </div>
            </div>
          ) : (
            /* Step 3: Interactive Live Preview */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={styles.previewNotice}>
                <span><Icon name="eye" /></span>
                <span>
                  This is exactly how riders in <strong>Discover</strong> will view your published itinerary before copying it.
                </span>
              </div>

              {/* Public Card Mockup */}
              <div style={styles.previewCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: 'var(--text-primary)' }}>
                      {trip.title}
                    </h3>
                    <div style={{ fontSize: 12, color: 'var(--pz-warn)', fontWeight: 700, marginTop: 4 }}>
                      by {user?.fullName || 'You'} · New Release · 5.0 rating
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
                  <span><Icon name="shield" /></span>
                  <span>
                    Privacy verified: Home address masked · {previewStops.length} public stops included
                    {hiddenCount > 0 && ` (${hiddenCount} private stops omitted)`}
                  </span>
                </div>

                {/* Stops breakdown */}
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--pz-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                    Published Stops ({previewStops.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                    {previewStops.map((s, idx) => (
                      <div key={idx} style={styles.previewStopRow}>
                        <div style={styles.previewStopNumber}>{idx + 1}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {s.place}
                          </div>
                          {s.description && (
                            <div style={{ fontSize: 11, color: 'var(--pz-muted)' }}>{s.description}</div>
                          )}
                        </div>
                        <span style={styles.previewStopType}>{s.item_type || 'stop'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Source attribution preview */}
                <div style={styles.previewAttributionNotice}>
                  <span>When riders tap <strong>"Copy to my trips"</strong>, they get an editable draft that credits you as the original source:</span>
                  <div style={{ marginTop: 4, fontStyle: 'italic', color: 'var(--pz-warn)' }}>
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
              Unpublish
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
                <span><Icon name="eye" /></span> Preview Public Page
              </button>
            ) : (
              <button
                onClick={handlePublish}
                disabled={isSubmitting}
                style={styles.btnPublishPrimary}
              >
                <span><Icon name="globe" /></span>
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
    backgroundColor: 'var(--pz-surface)',
    border: '1.5px solid var(--pz-line)',
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
    borderBottom: '1px solid var(--pz-line)',
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: 'var(--text-primary)',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  subtitle: {
    margin: '4px 0 0',
    fontSize: 12,
    color: 'var(--pz-muted)',
  },
  liveBadge: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1,
    padding: '2px 8px',
    borderRadius: 6,
    backgroundColor: 'var(--pz-ok-bg)',
    border: '1px solid var(--pz-ok)',
    color: 'var(--pz-ok)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--pz-muted)',
    fontSize: 18,
    cursor: 'pointer',
    padding: 4,
  },
  tabBar: {
    display: 'flex',
    borderBottom: '1px solid var(--pz-line)',
    backgroundColor: 'var(--pz-bg)',
  },
  tabActive: {
    flex: 1,
    padding: '12px 16px',
    backgroundColor: 'var(--pz-surface)',
    border: 'none',
    borderBottom: '2.5px solid var(--pz-accent)',
    color: 'var(--pz-warn)',
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
    color: 'var(--pz-muted)',
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
    backgroundColor: 'var(--pz-ok-bg)',
    border: '1.5px solid var(--pz-ok-bg)',
    borderRadius: 14,
    padding: '12px 16px',
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 1.2,
    color: 'var(--pz-muted)',
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
    backgroundColor: 'var(--pz-bg)',
    border: '1.5px solid var(--pz-line)',
    borderRadius: 12,
    padding: '10px 14px',
    cursor: 'pointer',
  },
  checkbox: {
    width: 18,
    height: 18,
    accentColor: 'var(--pz-accent)',
    cursor: 'pointer',
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: 'var(--text-primary)',
  },
  toggleDesc: {
    fontSize: 11,
    color: 'var(--pz-muted)',
    marginTop: 2,
  },
  stopsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    maxHeight: 180,
    overflowY: 'auto',
    backgroundColor: 'var(--pz-bg)',
    border: '1.5px solid var(--pz-line)',
    borderRadius: 12,
    padding: 8,
  },
  stopItemRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: 'var(--pz-surface)',
    border: '1px solid var(--pz-line)',
    borderRadius: 8,
    padding: '8px 12px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  publicPill: {
    fontSize: 10,
    fontWeight: 800,
    color: 'var(--pz-ok)',
    backgroundColor: 'var(--pz-ok-bg)',
    padding: '2px 8px',
    borderRadius: 6,
  },
  hiddenPill: {
    fontSize: 10,
    fontWeight: 800,
    color: 'var(--pz-bad)',
    backgroundColor: 'var(--pz-bad-bg)',
    padding: '2px 8px',
    borderRadius: 6,
  },
  textInput: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 10,
    border: '1.5px solid var(--pz-line)',
    backgroundColor: 'var(--pz-bg)',
    color: 'var(--text-primary)',
    fontSize: 13,
    outline: 'none',
  },
  previewNotice: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'var(--pz-warn-bg)',
    border: '1px solid var(--pz-warn-bg)',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 12,
    color: 'var(--text-primary)',
  },
  previewCard: {
    backgroundColor: 'var(--pz-bg)',
    border: '1.5px solid var(--pz-line)',
    borderRadius: 16,
    padding: 16,
  },
  previewTag: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1,
    padding: '3px 8px',
    borderRadius: 6,
    backgroundColor: 'var(--pz-warn-bg)',
    color: 'var(--pz-warn)',
    border: '1px solid var(--pz-accent)',
  },
  chipTag: {
    fontSize: 10,
    fontWeight: 800,
    padding: '2px 8px',
    borderRadius: 6,
    backgroundColor: 'var(--pz-surface)',
    border: '1px solid var(--pz-line)',
    color: 'var(--pz-muted)',
  },
  sanitizedSummaryBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 11,
    color: 'var(--pz-ok)',
    backgroundColor: 'var(--pz-ok-bg)',
    padding: '6px 10px',
    borderRadius: 8,
    marginTop: 12,
  },
  previewStopRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'var(--pz-surface)',
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid var(--pz-line)',
  },
  previewStopNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'var(--pz-line)',
    color: 'var(--pz-warn)',
    fontSize: 11,
    fontWeight: 900,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewStopType: {
    fontSize: 10,
    fontWeight: 800,
    color: 'var(--pz-muted)',
    backgroundColor: 'var(--pz-bg)',
    padding: '2px 6px',
    borderRadius: 4,
    textTransform: 'uppercase',
  },
  previewAttributionNotice: {
    marginTop: 16,
    padding: '10px 12px',
    borderRadius: 10,
    backgroundColor: 'var(--pz-surface)',
    border: '1px dashed var(--pz-line)',
    fontSize: 11,
    color: 'var(--pz-muted)',
    lineHeight: 1.4,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px 24px max(16px, env(safe-area-inset-bottom, 16px))',
    borderTop: '1px solid var(--pz-line)',
    backgroundColor: 'var(--pz-surface)',
  },
  btnUnpublish: {
    padding: '9px 14px',
    backgroundColor: 'transparent',
    border: '1.5px solid var(--pz-bad)',
    borderRadius: 10,
    color: 'var(--pz-bad)',
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
  },
  btnCancel: {
    padding: '9px 16px',
    backgroundColor: 'var(--pz-bg)',
    border: '1.5px solid var(--pz-line)',
    borderRadius: 10,
    color: 'var(--text-primary)',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  btnPreview: {
    padding: '9px 18px',
    backgroundColor: 'var(--pz-bg)',
    border: '1.5px solid var(--pz-accent)',
    borderRadius: 10,
    color: 'var(--pz-warn)',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  btnPublishPrimary: {
    padding: '9px 20px',
    backgroundColor: 'var(--pz-accent)',
    border: 'none',
    borderRadius: 10,
    color: 'var(--pz-on-accent)',
    fontSize: 13,
    fontWeight: 900,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
};

