import React, { useState } from 'react';

interface PresetsTellGroupSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStatus: (preset: string) => void;
  onSendAnnouncement?: (announcement: string) => void;
  isCaptain?: boolean;
}

const RIDER_PRESETS = [
  { id: 'on_my_way', label: 'On my way', icon: '🏍️' },
  { id: 'need_fuel', label: 'Need fuel', icon: '⛽' },
  { id: 'need_break', label: 'Need a break', icon: '☕' },
  { id: 'behind_wait', label: 'Behind, wait', icon: '⏳' },
  { id: 'lost_call', label: 'Lost, call me', icon: '📞' },
  { id: 'all_good', label: 'All good', icon: '✅' },
];

const CAPTAIN_PRESETS = [
  { id: 'fuel_next_town', label: 'Fuel at next town', icon: '⛽' },
  { id: 'gravel_ahead', label: 'Gravel ahead', icon: '⚠️' },
  { id: 'slow_down', label: 'Slow down', icon: '🛑' },
  { id: 'regroup_junction', label: 'Regroup at junction', icon: '🚨' },
];

export const PresetsTellGroupSheet: React.FC<PresetsTellGroupSheetProps> = ({
  isOpen,
  onClose,
  onSelectStatus,
  onSendAnnouncement,
  isCaptain = false,
}) => {
  const [sentPreset, setSentPreset] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRiderPresetClick = (label: string) => {
    if ('vibrate' in navigator) navigator.vibrate([40]);
    setSentPreset(label);
    onSelectStatus(label);
    setTimeout(() => {
      setSentPreset(null);
      onClose();
    }, 400);
  };

  const handleCaptainAnnouncementClick = (label: string) => {
    if ('vibrate' in navigator) navigator.vibrate([40, 60, 40]);
    setSentPreset(label);
    if (onSendAnnouncement) onSendAnnouncement(label);
    setTimeout(() => {
      setSentPreset(null);
      onClose();
    }, 400);
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
        {/* Drag Handle */}
        <div style={styles.handleWrap} onClick={onClose}>
          <div style={styles.handle} />
        </div>

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.titleRow}>
            <h2 style={styles.title}>Tell group</h2>
            <span style={styles.subtitle}>Sends with your name and time</span>
          </div>
        </div>

        {/* Rider Status Presets Grid */}
        <div style={styles.grid}>
          {RIDER_PRESETS.map((p) => {
            const isSelected = sentPreset === p.label;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleRiderPresetClick(p.label)}
                style={{
                  ...styles.presetBtn,
                  backgroundColor: isSelected ? '#E5A900' : '#FFFFFF',
                  color: '#1C1917',
                  borderColor: isSelected ? '#E5A900' : '#E2DED6',
                }}
              >
                <span style={styles.btnLabel}>{p.label}</span>
              </button>
            );
          })}
        </div>

        {/* Captain Announcements Section */}
        {isCaptain && (
          <div style={styles.captainSection}>
            <div style={styles.captainHeader}>
              <span style={styles.captainTitle}>CAPTAIN ANNOUNCEMENTS</span>
            </div>

            <div style={styles.grid}>
              {CAPTAIN_PRESETS.map((cp) => {
                const isSelected = sentPreset === cp.label;
                return (
                  <button
                    key={cp.id}
                    type="button"
                    onClick={() => handleCaptainAnnouncementClick(cp.label)}
                    style={{
                      ...styles.presetBtn,
                      backgroundColor: isSelected ? '#E5A900' : '#FFFFFF',
                      color: '#1C1917',
                      borderColor: isSelected ? '#E5A900' : '#E2DED6',
                    }}
                  >
                    <span style={styles.btnLabel}>{cp.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Close button matching mockup */}
        <button
          type="button"
          onClick={onClose}
          style={styles.closeBtn}
        >
          Close
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(28, 25, 23, 0.45)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: 540,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTop: '1.5px solid #E2DED6',
    padding: '12px 20px 24px',
    boxShadow: '0 -10px 40px rgba(28, 25, 23, 0.15)',
    animation: 'slideUp 0.25s ease-out',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  handleWrap: {
    display: 'flex',
    justifyContent: 'center',
    padding: '4px 0 10px',
    cursor: 'pointer',
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#D6D3D1',
  },
  header: {
    marginBottom: 16,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 900,
    color: '#1C1917',
    margin: 0,
  },
  subtitle: {
    fontSize: 12,
    color: '#78716C',
    fontWeight: 500,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
    marginBottom: 16,
  },
  presetBtn: {
    padding: '16px 14px',
    borderRadius: 14,
    border: '1.5px solid #E2DED6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.15s ease',
    minHeight: 56,
    boxShadow: '0 2px 4px rgba(28, 25, 23, 0.03)',
  },
  btnLabel: {
    fontWeight: 700,
    fontSize: 14,
    lineHeight: 1.2,
  },
  captainSection: {
    marginTop: 4,
    padding: '14px 14px 4px',
    backgroundColor: '#F5F3EF',
    borderRadius: 18,
    border: '1.5px solid #E2DED6',
    marginBottom: 16,
  },
  captainHeader: {
    marginBottom: 10,
  },
  captainTitle: {
    fontSize: 11,
    fontWeight: 800,
    color: '#78716C',
    letterSpacing: 1,
  },
  closeBtn: {
    width: '100%',
    padding: '14px',
    borderRadius: 14,
    border: '1.5px solid #E2DED6',
    backgroundColor: '#FFFFFF',
    color: '#1C1917',
    fontWeight: 800,
    fontSize: 15,
    cursor: 'pointer',
    marginTop: 4,
  },
};

export default PresetsTellGroupSheet;

