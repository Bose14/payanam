import React, { useState } from 'react';

export interface PinnedStopData {
  id?: string;
  name: string;
  lat: number;
  lng: number;
  type: string;
  dayNumber?: number;
  description?: string;
}

interface PlannedStopOption {
  id?: string;
  place: string;
  item_type?: string;
  day_number: number;
  order_index?: number;
  lat?: number | null;
  lng?: number | null;
  description?: string;
}

interface PinStopModalProps {
  isOpen: boolean;
  onClose: () => void;
  plannedStops: PlannedStopOption[];
  currentGps?: { lat: number; lng: number } | null;
  onPinStop: (stop: PinnedStopData, addToItinerary?: boolean) => Promise<void>;
}

const STOP_TYPES = [
  { value: 'fuel_stop', label: 'Fuel Pump', icon: '⛽' },
  { value: 'meal', label: 'Food / Dhaba', icon: '🍽️' },
  { value: 'rest', label: 'Chai / Rest', icon: '☕' },
  { value: 'attraction', label: 'Viewpoint', icon: '📍' },
  { value: 'stop', label: 'Regroup Point', icon: '📌' },
  { value: 'stay', label: 'Hotel / Stay', icon: '🏨' },
];

export default function PinStopModal({
  isOpen,
  onClose,
  plannedStops,
  currentGps,
  onPinStop,
}: PinStopModalProps) {
  const [tab, setTab] = useState<'planned' | 'live'>('planned');
  const [customName, setCustomName] = useState('');
  const [customType, setCustomType] = useState('fuel_stop');
  const [useCurrentLocation, setUseCurrentLocation] = useState(true);
  const [customLat, setCustomLat] = useState<string>('');
  const [customLng, setCustomLng] = useState<string>('');
  const [addToItinerary, setAddToItinerary] = useState(true);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const validPlannedStops = plannedStops.filter((s) => s.lat != null && s.lng != null);

  const handleSelectPlanned = async (s: PlannedStopOption) => {
    if (!s.lat || !s.lng) return;
    setSaving(true);
    try {
      await onPinStop({
        id: s.id,
        name: s.place,
        lat: s.lat,
        lng: s.lng,
        type: s.item_type || 'stop',
        dayNumber: s.day_number,
        description: s.description,
      }, false);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleLivePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    let targetLat = 0;
    let targetLng = 0;

    if (useCurrentLocation && currentGps) {
      targetLat = currentGps.lat;
      targetLng = currentGps.lng;
    } else if (customLat && customLng) {
      targetLat = parseFloat(customLat);
      targetLng = parseFloat(customLng);
    } else {
      // Try geocoding place name
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(customName)}&format=json&limit=1&countrycodes=in`,
          { headers: { 'Accept-Language': 'en', 'User-Agent': 'Payanam-App/1.0' } }
        );
        const data = await res.json();
        if (data?.[0]) {
          targetLat = parseFloat(data[0].lat);
          targetLng = parseFloat(data[0].lon);
        }
      } catch { /* silent */ }
    }

    if (!targetLat || !targetLng) {
      alert('Unable to find coordinates for this stop. Please check location permission or enter coordinates.');
      return;
    }

    setSaving(true);
    try {
      await onPinStop({
        name: customName.trim(),
        lat: targetLat,
        lng: targetLng,
        type: customType,
        description: 'Live pinned stop',
      }, addToItinerary);
      setCustomName('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.dragHandle} />

        <div style={styles.header}>
          <div style={{ fontSize: 26 }}>📍</div>
          <div style={{ flex: 1 }}>
            <h3 style={styles.title}>Pin Convoy Target Stop</h3>
            <p style={styles.subtitle}>Sets shared destination & live ETA countdown for all riders</p>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        {/* Tab switch */}
        <div style={styles.tabContainer}>
          <button
            type="button"
            onClick={() => setTab('planned')}
            style={{
              ...styles.tabBtn,
              background: tab === 'planned' ? '#F0C23A' : 'transparent',
              color: tab === 'planned' ? '#111316' : '#9D9C9A',
              fontWeight: 900,
            }}
          >
            📋 Planned Stops ({validPlannedStops.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('live')}
            style={{
              ...styles.tabBtn,
              background: tab === 'live' ? '#F0C23A' : 'transparent',
              color: tab === 'live' ? '#111316' : '#9D9C9A',
              fontWeight: 900,
            }}
          >
            ⚡ Live Custom Pin
          </button>
        </div>

        {tab === 'planned' ? (
          <div style={styles.plannedList}>
            {validPlannedStops.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: '#9ca3af' }}>
                <p>No planned stops with GPS coordinates found.</p>
                <button
                  onClick={() => setTab('live')}
                  style={{ marginTop: 8, padding: '8px 16px', background: '#374151', color: '#60a5fa', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}
                >
                  + Drop a Live Pin
                </button>
              </div>
            ) : (
              validPlannedStops.map((s, idx) => (
                <button
                  key={s.id || idx}
                  type="button"
                  onClick={() => handleSelectPlanned(s)}
                  disabled={saving}
                  style={styles.stopCard}
                >
                  <div style={{ fontSize: 24, flexShrink: 0 }}>
                    {STOP_TYPES.find((t) => t.value === s.item_type)?.icon || '📌'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>
                      Day {s.day_number} · {s.place}
                    </div>
                    {s.description && (
                      <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.description}
                      </div>
                    )}
                  </div>
                  <span style={styles.pinTag}>Pin Stop ➔</span>
                </button>
              ))
            )}
          </div>
        ) : (
          <form onSubmit={handleLivePin} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
            <div>
              <label style={styles.label}>Stop Name / Landmark *</label>
              <input
                type="text"
                required
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. HP Petrol Pump / Sharma Dhaba"
                style={styles.input}
              />
            </div>

            <div>
              <label style={styles.label}>Stop Category</label>
              <div style={styles.typeGrid}>
                {STOP_TYPES.map((t) => {
                  const isSel = customType === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setCustomType(t.value)}
                      style={{
                        ...styles.typeBtn,
                        border: isSel ? '2px solid #3b82f6' : '1px solid #374151',
                        background: isSel ? 'rgba(59, 130, 246, 0.2)' : '#111827',
                        color: isSel ? '#60a5fa' : '#9ca3af',
                      }}
                    >
                      <span>{t.icon}</span> {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {currentGps && (
              <div style={styles.checkRow}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#fff', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={useCurrentLocation}
                    onChange={(e) => setUseCurrentLocation(e.target.checked)}
                  />
                  <span>📍 Pin at my current GPS location ({currentGps.lat.toFixed(4)}, {currentGps.lng.toFixed(4)})</span>
                </label>
              </div>
            )}

            {!useCurrentLocation && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={styles.label}>Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={customLat}
                    onChange={(e) => setCustomLat(e.target.value)}
                    placeholder="12.9716"
                    style={styles.input}
                  />
                </div>
                <div>
                  <label style={styles.label}>Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={customLng}
                    onChange={(e) => setCustomLng(e.target.value)}
                    placeholder="77.5946"
                    style={styles.input}
                  />
                </div>
              </div>
            )}

            <div style={styles.checkRow}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#9ca3af', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={addToItinerary}
                  onChange={(e) => setAddToItinerary(e.target.checked)}
                />
                <span>Add this stop to the trip itinerary permanently</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button type="button" onClick={onClose} style={styles.btnCancel}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !customName.trim()}
                style={styles.btnSubmit}
              >
                {saving ? '⏳ Pinning...' : '📍 Pin & Alert Convoy'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    backdropFilter: 'blur(5px)',
    WebkitBackdropFilter: 'blur(5px)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    animation: 'fadeIn 0.2s ease-out',
  },
  sheet: {
    backgroundColor: '#1B1E23',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    maxWidth: 520,
    padding: '14px 18px 28px',
    boxShadow: '0 -10px 40px rgba(0,0,0,0.6)',
    borderTop: '1.5px solid #2A2E35',
    boxSizing: 'border-box',
    maxHeight: '88vh',
    overflowY: 'auto',
  },
  dragHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3A3F47',
    margin: '0 auto 14px',
    cursor: 'pointer',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  title: {
    color: '#F1EFEA',
    fontSize: 18,
    fontWeight: 900,
    margin: 0,
    letterSpacing: -0.2,
  },
  subtitle: {
    color: '#9D9C9A',
    fontSize: 12,
    margin: '2px 0 0',
  },
  closeBtn: {
    background: '#111316',
    border: '1px solid #2A2E35',
    color: '#9D9C9A',
    borderRadius: '50%',
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
  },
  tabContainer: {
    display: 'flex',
    background: '#111316',
    padding: 4,
    borderRadius: 12,
    border: '1px solid #2A2E35',
    gap: 4,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    padding: '8px 12px',
    border: 'none',
    borderRadius: 8,
    fontWeight: 800,
    fontSize: 13,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  plannedList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxHeight: '45vh',
    overflowY: 'auto',
  },
  stopCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    background: '#111316',
    border: '1.5px solid #2A2E35',
    borderRadius: 14,
    cursor: 'pointer',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'all 0.15s ease',
  },
  pinTag: {
    background: '#F0C23A',
    color: '#111316',
    fontSize: 11,
    fontWeight: 900,
    padding: '4px 8px',
    borderRadius: 6,
    flexShrink: 0,
  },
  label: {
    display: 'block',
    color: '#9D9C9A',
    fontSize: 11.5,
    fontWeight: 700,
    marginBottom: 4,
  },
  input: {
    width: '100%',
    background: '#111316',
    border: '1.5px solid #2A2E35',
    borderRadius: 10,
    padding: '10px 14px',
    color: '#F1EFEA',
    fontSize: 13.5,
    outline: 'none',
    boxSizing: 'border-box',
  },
  typeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
  },
  typeBtn: {
    padding: '8px 6px',
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    border: '1px solid #2A2E35',
    transition: 'all 0.15s ease',
  },
  checkRow: {
    background: '#111316',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #2A2E35',
  },
  btnCancel: {
    flex: 1,
    padding: '12px',
    background: '#111316',
    border: '1.5px solid #2A2E35',
    borderRadius: 12,
    color: '#9D9C9A',
    fontWeight: 800,
    fontSize: 13,
    cursor: 'pointer',
  },
  btnSubmit: {
    flex: 2,
    padding: '12px',
    background: '#F0C23A',
    border: 'none',
    borderRadius: 12,
    color: '#111316',
    fontWeight: 900,
    fontSize: 13.5,
    cursor: 'pointer',
    boxShadow: '0 2px 10px rgba(240, 194, 58, 0.25)',
  },
};
