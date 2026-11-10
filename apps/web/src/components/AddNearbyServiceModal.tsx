import { useState } from 'react';
import { NearbyServiceItem, addNearbyPlace } from '../utils/nearbyServices';

interface AddNearbyServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentGps?: { lat: number; lng: number } | null;
  userName?: string;
  onPlaceAdded?: (place: NearbyServiceItem) => void;
}

export default function AddNearbyServiceModal({
  isOpen,
  onClose,
  currentGps,
  userName,
  onPlaceAdded,
}: AddNearbyServiceModalProps) {
  const [category, setCategory] = useState<'FUEL' | 'REPAIR' | 'FOOD' | 'REST' | 'STAY'>('REPAIR');
  const [name, setName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [lat, setLat] = useState<number>(currentGps?.lat ?? 14.1500);
  const [lng, setLng] = useState<number>(currentGps?.lng ?? 75.0500);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const added = addNearbyPlace({
      category,
      name: name.trim(),
      subtitle: subtitle.trim() || `${category} service along route`,
      phone: phone.trim() || undefined,
      notes: notes.trim() || undefined,
      lat: Number(lat),
      lng: Number(lng),
      userName,
    });

    onPlaceAdded?.(added);
    onClose();
  };

  const CATEGORIES: Array<{ id: 'FUEL' | 'REPAIR' | 'FOOD' | 'REST' | 'STAY'; label: string; icon: string }> = [
    { id: 'FUEL', label: 'Fuel', icon: '⛽' },
    { id: 'REPAIR', label: 'Repair', icon: '🔧' },
    { id: 'FOOD', label: 'Food', icon: '🍽️' },
    { id: 'REST', label: 'Rest', icon: '☕' },
    { id: 'STAY', label: 'Stay', icon: '🏨' },
  ];

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>📍</span>
            <div>
              <h3 style={styles.title}>Add Place to Route Corridor</h3>
              <p style={styles.subtitle}>Feature 3 · Community verified service for riders in need</p>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={styles.body}>
          {/* Category Picker */}
          <div>
            <label style={styles.inputLabel}>CATEGORY</label>
            <div style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    style={{
                      ...styles.categoryBtn,
                      backgroundColor: isSelected ? '#F0C23A' : '#111316',
                      color: isSelected ? '#111316' : '#9D9C9A',
                      borderColor: isSelected ? '#F0C23A' : '#2A2E35',
                    }}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Place Name */}
          <div>
            <label style={styles.inputLabel}>PLACE OR SHOP NAME *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Babu Puncture & Highway Welding"
              style={styles.textInput}
            />
          </div>

          {/* Subtitle / Services offered */}
          <div>
            <label style={styles.inputLabel}>SERVICES OFFERED / SUBTITLE</label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="e.g. Tubeless patches, air tower, chain lube"
              style={styles.textInput}
            />
          </div>

          {/* Phone Number */}
          <div>
            <label style={styles.inputLabel}>PHONE NUMBER (FOR RIDER CALLS)</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +91 98450 12345"
              style={styles.textInput}
            />
          </div>

          {/* Location note */}
          <div style={styles.gpsRow}>
            <span>📍 Location:</span>
            <span style={{ color: '#F1EFEA', fontWeight: 700 }}>
              {lat.toFixed(4)}, {lng.toFixed(4)}
            </span>
            {currentGps && (
              <button
                type="button"
                onClick={() => {
                  setLat(currentGps.lat);
                  setLng(currentGps.lng);
                }}
                style={styles.btnGpsRefresh}
              >
                Use Current GPS
              </button>
            )}
          </div>

          {/* Rider Notes */}
          <div>
            <label style={styles.inputLabel}>HELPFUL NOTES (OPTIONAL)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Open till 11 PM, has Royal Enfield clutch cables"
              style={styles.textarea}
            />
          </div>

          {/* Actions */}
          <div style={styles.footer}>
            <button type="button" onClick={onClose} style={styles.btnCancel}>
              Cancel
            </button>
            <button type="submit" style={styles.btnAdd}>
              ✓ Add to Nearby Help
            </button>
          </div>
        </form>
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
    zIndex: 10001,
    padding: 16,
  },
  modal: {
    backgroundColor: '#1B1E23',
    border: '1.5px solid #2A2E35',
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '18px 22px 14px',
    borderBottom: '1px solid #2A2E35',
  },
  title: {
    margin: 0,
    fontSize: 17,
    fontWeight: 900,
    color: '#F1EFEA',
  },
  subtitle: {
    margin: '3px 0 0',
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
  body: {
    padding: '18px 22px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    overflowY: 'auto',
    maxHeight: '78vh',
  },
  inputLabel: {
    display: 'block',
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 1,
    color: '#9D9C9A',
    marginBottom: 6,
  },
  categoryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 6,
  },
  categoryBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '8px 4px',
    borderRadius: 10,
    border: '1.5px solid',
    fontSize: 11,
    fontWeight: 800,
    cursor: 'pointer',
  },
  textInput: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 10,
    border: '1.5px solid #2A2E35',
    backgroundColor: '#111316',
    color: '#F1EFEA',
    fontSize: 13,
    outline: 'none',
  },
  textarea: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 10,
    border: '1.5px solid #2A2E35',
    backgroundColor: '#111316',
    color: '#F1EFEA',
    fontSize: 13,
    outline: 'none',
    fontFamily: 'inherit',
    resize: 'none',
  },
  gpsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    color: '#9D9C9A',
    backgroundColor: '#111316',
    border: '1px solid #2A2E35',
    padding: '8px 12px',
    borderRadius: 10,
    flexWrap: 'wrap',
  },
  btnGpsRefresh: {
    marginLeft: 'auto',
    padding: '3px 8px',
    backgroundColor: '#1B1E23',
    border: '1px solid #F0C23A',
    borderRadius: 6,
    color: '#F0C23A',
    fontSize: 10,
    fontWeight: 800,
    cursor: 'pointer',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
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
  btnAdd: {
    padding: '9px 20px',
    backgroundColor: '#F0C23A',
    border: 'none',
    borderRadius: 10,
    color: '#111316',
    fontSize: 13,
    fontWeight: 900,
    cursor: 'pointer',
  },
};
