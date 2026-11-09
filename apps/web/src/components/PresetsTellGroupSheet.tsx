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
          <h2 style={styles.title}>Tell group</h2>
          <span style={styles.subtitle}>Sends with your name and time · glove friendly</span>
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
                  backgroundColor: isSelected ? 'var(--accent-gold, #f59e0b)' : '#1f2937',
                  color: isSelected ? '#000000' : '#ffffff',
                  borderColor: isSelected ? 'var(--accent-gold, #f59e0b)' : '#374151',
                }}
              >
                <span style={{ fontSize: 16 }}>{p.icon}</span>
                <span style={styles.btnLabel}>{p.label}</span>
              </button>
            );
          })}
        </div>

        {/* Captain Announcements Section */}
        {isCaptain && (
          <div style={styles.captainSection}>
            <div style={styles.captainHeader}>
              <span style={{ fontSize: 13 }}>👑</span>
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
                      backgroundColor: isSelected ? '#ef4444' : '#1f2937',
                      color: isSelected ? '#ffffff' : '#fca5a5',
                      borderColor: isSelected ? '#ef4444' : 'rgba(239, 68, 68, 0.4)',
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{cp.icon}</span>
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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
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
    backgroundColor: 'var(--bg-card, #111827)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTop: '1px solid var(--border-card, #374151)',
    padding: '12px 20px 24px',
    boxShadow: '0 -8px 30px rgba(0, 0, 0, 0.5)',
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
    backgroundColor: '#4b5563',
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 900,
    color: 'var(--text-primary, #ffffff)',
    margin: 0,
  },
  subtitle: {
    fontSize: 12,
    color: 'var(--text-secondary, #9ca3af)',
    marginTop: 4,
    display: 'block',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
    marginBottom: 18,
  },
  presetBtn: {
    padding: '16px 14px',
    borderRadius: 14,
    border: '1.5px solid #374151',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s ease',
    minHeight: 56,
  },
  btnLabel: {
    fontWeight: 800,
    fontSize: 14,
    lineHeight: 1.2,
  },
  captainSection: {
    marginTop: 4,
    paddingTop: 14,
    borderTop: '1px solid #374151',
  },
  captainHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  captainTitle: {
    fontSize: 11,
    fontWeight: 800,
    color: '#f87171',
    letterSpacing: 1,
  },
  closeBtn: {
    width: '100%',
    padding: '14px',
    borderRadius: 14,
    border: '1.5px solid #374151',
    backgroundColor: '#1f2937',
    color: '#ffffff',
    fontWeight: 800,
    fontSize: 15,
    cursor: 'pointer',
    marginTop: 6,
  },
};

export default PresetsTellGroupSheet;

