import React, { useState } from 'react';

interface ShareLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentGps?: { lat: number; lng: number } | null;
  onShareLocation: (locationData: {
    placeName: string;
    lat: number;
    lng: number;
    note?: string;
  }) => Promise<void>;
}

export default function ShareLocationModal({
  isOpen,
  onClose,
  currentGps,
  onShareLocation,
}: ShareLocationModalProps) {
  const [mode, setMode] = useState<'current' | 'pin'>('current');
  const [placeName, setPlaceName] = useState('');
  const [note, setNote] = useState('');
  const [pinLat, setPinLat] = useState('');
  const [pinLng, setPinLng] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [sharing, setSharing] = useState(false);

  if (!isOpen) return null;

  const handleSearchPlace = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          searchQuery
        )}&format=json&limit=1&countrycodes=in`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'Payanam-App/1.0' } }
      );
      const data = await res.json();
      if (data && data[0]) {
        const found = data[0];
        setPinLat(parseFloat(found.lat).toFixed(6));
        setPinLng(parseFloat(found.lon).toFixed(6));
        if (!placeName) {
          setPlaceName(found.display_name.split(',')[0]);
        }
      } else {
        alert('Location not found. Please try another place name.');
      }
    } catch {
      alert('Search failed. Please check network connection.');
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let finalLat = 0;
    let finalLng = 0;

    if (mode === 'current') {
      if (!currentGps) {
        alert('GPS location is not available yet. Please enable GPS.');
        return;
      }
      finalLat = currentGps.lat;
      finalLng = currentGps.lng;
    } else {
      finalLat = parseFloat(pinLat);
      finalLng = parseFloat(pinLng);
      if (isNaN(finalLat) || isNaN(finalLng)) {
        alert('Please enter valid coordinates or search for a place.');
        return;
      }
    }

    const finalName = placeName.trim() ||
      (mode === 'current'
        ? `Location (${finalLat.toFixed(4)}, ${finalLng.toFixed(4)})`
        : searchQuery.trim() || 'Dropped Pin');

    setSharing(true);
    try {
      await onShareLocation({
        placeName: finalName,
        lat: finalLat,
        lng: finalLng,
        note: note.trim() || undefined,
      });
      onClose();
    } finally {
      setSharing(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          backgroundColor: '#111316',
          border: '1.5px solid #2A2E35',
          borderRadius: 20,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 18px',
            borderBottom: '1.5px solid #2A2E35',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>📍</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#F1EFEA' }}>
                Share Location in Trip Chat
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9D9C9A' }}>
                Convoy can view on map & Captain can confirm as stop
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#9D9C9A',
              fontSize: 18,
              cursor: 'pointer',
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div style={{ display: 'flex', padding: '12px 18px 0', gap: 8 }}>
          <button
            type="button"
            onClick={() => setMode('current')}
            style={{
              flex: 1,
              padding: '9px 12px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: mode === 'current' ? '#F0C23A' : '#1B1E23',
              color: mode === 'current' ? '#111316' : '#9D9C9A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <span>🎯</span> Current GPS
          </button>
          <button
            type="button"
            onClick={() => setMode('pin')}
            style={{
              flex: 1,
              padding: '9px 12px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: mode === 'pin' ? '#F0C23A' : '#1B1E23',
              color: mode === 'pin' ? '#111316' : '#9D9C9A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <span>📌</span> Dropped Pin / Search
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'current' ? (
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: '#1B1E23',
                border: '1px solid #2A2E35',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  backgroundColor: currentGps ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: currentGps ? '1px solid #10B981' : '1px solid #EF4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                }}
              >
                {currentGps ? '🛰️' : '⚠️'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#F1EFEA' }}>
                  {currentGps ? 'Live GPS Position Locked' : 'Acquiring GPS...'}
                </div>
                <div style={{ fontSize: 11, color: '#9D9C9A', marginTop: 2 }}>
                  {currentGps
                    ? `${currentGps.lat.toFixed(6)}, ${currentGps.lng.toFixed(6)}`
                    : 'Please wait or switch to dropped pin'}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="Search landmark, town, fuel bunk..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearchPlace())}
                  style={{
                    flex: 1,
                    backgroundColor: '#1B1E23',
                    border: '1.5px solid #2A2E35',
                    borderRadius: 10,
                    padding: '9px 12px',
                    color: '#F1EFEA',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={handleSearchPlace}
                  disabled={searching || !searchQuery.trim()}
                  style={{
                    padding: '9px 14px',
                    backgroundColor: '#2A2E35',
                    color: '#F1EFEA',
                    border: 'none',
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: searching ? 'not-allowed' : 'pointer',
                  }}
                >
                  {searching ? '...' : 'Search'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number"
                  step="any"
                  placeholder="Latitude (e.g. 14.1670)"
                  value={pinLat}
                  onChange={(e) => setPinLat(e.target.value)}
                  style={{
                    flex: 1,
                    backgroundColor: '#1B1E23',
                    border: '1px solid #2A2E35',
                    borderRadius: 8,
                    padding: '8px 10px',
                    color: '#F1EFEA',
                    fontSize: 12,
                    outline: 'none',
                  }}
                />
                <input
                  type="number"
                  step="any"
                  placeholder="Longitude (e.g. 75.0400)"
                  value={pinLng}
                  onChange={(e) => setPinLng(e.target.value)}
                  style={{
                    flex: 1,
                    backgroundColor: '#1B1E23',
                    border: '1px solid #2A2E35',
                    borderRadius: 8,
                    padding: '8px 10px',
                    color: '#F1EFEA',
                    fontSize: 12,
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          )}

          {/* Place Name Input */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 800, color: '#9D9C9A', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>
              Place Name / Landmark
            </label>
            <input
              type="text"
              placeholder="e.g. Sagar Highway Dhaba · Shell Bunk"
              value={placeName}
              onChange={(e) => setPlaceName(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#1B1E23',
                border: '1.5px solid #2A2E35',
                borderRadius: 10,
                padding: '9px 12px',
                color: '#F1EFEA',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Note Input */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 800, color: '#9D9C9A', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>
              Note for Group (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Good chai, shaded parking, clean washrooms"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#1B1E23',
                border: '1.5px solid #2A2E35',
                borderRadius: 10,
                padding: '9px 12px',
                color: '#F1EFEA',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={sharing || (mode === 'current' && !currentGps) || (mode === 'pin' && (!pinLat || !pinLng))}
            style={{
              width: '100%',
              marginTop: 6,
              padding: '12px',
              backgroundColor: '#F0C23A',
              color: '#111316',
              border: 'none',
              borderRadius: 12,
              fontWeight: 900,
              fontSize: 14,
              cursor: sharing ? 'not-allowed' : 'pointer',
              opacity: sharing || (mode === 'current' && !currentGps) ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 4px 12px rgba(240, 194, 58, 0.25)',
            }}
          >
            <span>📍</span>
            <span>{sharing ? 'Posting to Chat...' : 'Share Location with Convoy'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

