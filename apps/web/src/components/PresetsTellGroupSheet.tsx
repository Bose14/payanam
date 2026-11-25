import Icon from './Icon';
import React, { useState } from 'react';

import { RIDER_STATUS_PRESETS } from '../utils/statusPresets';

interface PresetsTellGroupSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStatus: (preset: string) => void;
  onSendAnnouncement?: (announcement: string) => void;
  isCaptain?: boolean;
}

const RIDER_PRESETS = RIDER_STATUS_PRESETS;

const CAPTAIN_PRESETS = [
  { id: 'fuel_next_town', label: 'Fuel at next town', icon: 'fuel' },
  { id: 'gravel_ahead', label: 'Gravel ahead', icon: 'warning' },
  { id: 'slow_down', label: 'Slow down', icon: 'stop' },
  { id: 'regroup_junction', label: 'Regroup at junction', icon: 'alert' },
  { id: 'police_check', label: 'Police check ahead', icon: 'user' },
  { id: 'change_plan', label: 'Change of plan', icon: 'refresh' },
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
                  backgroundColor: isSelected ? 'var(--pz-accent)' : 'var(--pz-surface)',
                  color: isSelected ? 'var(--pz-bg)' : 'var(--text-primary)',
                  borderColor: isSelected ? 'var(--pz-accent)' : 'var(--pz-line)',
                }}
              >
                <span style={{ fontSize: 18, marginRight: 8, lineHeight: 1 }}><Icon name={p.icon} /></span>
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
                      backgroundColor: isSelected ? 'var(--pz-accent)' : 'var(--pz-surface)',
                      color: isSelected ? 'var(--pz-bg)' : 'var(--text-primary)',
                      borderColor: isSelected ? 'var(--pz-accent)' : 'var(--pz-line)',
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(5px)',
    WebkitBackdropFilter: 'blur(5px)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: 540,
    backgroundColor: 'var(--pz-surface)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTop: '1.5px solid var(--pz-line)',
    padding: '12px 20px 24px',
    boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.5)',
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
    backgroundColor: 'var(--pz-line)',
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
    color: 'var(--text-primary)',
    margin: 0,
  },
  subtitle: {
    fontSize: 12,
    color: 'var(--pz-muted)',
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
    border: '1.5px solid var(--pz-line)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.15s ease',
    minHeight: 56,
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
  },
  btnLabel: {
    fontWeight: 700,
    fontSize: 14,
    lineHeight: 1.2,
  },
  captainSection: {
    marginTop: 4,
    padding: '14px 14px 4px',
    backgroundColor: 'var(--pz-bg)',
    borderRadius: 18,
    border: '1.5px solid var(--pz-line)',
    marginBottom: 16,
  },
  captainHeader: {
    marginBottom: 10,
  },
  captainTitle: {
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--pz-muted)',
    letterSpacing: 1,
  },
  closeBtn: {
    width: '100%',
    padding: '14px',
    borderRadius: 14,
    border: '1.5px solid var(--pz-line)',
    backgroundColor: 'var(--pz-surface)',
    color: 'var(--text-primary)',
    fontWeight: 800,
    fontSize: 15,
    cursor: 'pointer',
    marginTop: 4,
  },
};

export default PresetsTellGroupSheet;

