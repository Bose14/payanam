import React, { useState } from 'react';

export interface AnnouncementPreset {
  id: string;
  icon: string;
  title: string;
  description: string;
  urgency: 'high' | 'medium' | 'info';
}

export const ANNOUNCEMENT_PRESETS: AnnouncementPreset[] = [
  {
    id: 'regroup',
    icon: '🚨',
    title: 'Regroup Ahead',
    description: 'Slow down and regroup at next safe shoulder or pump',
    urgency: 'high',
  },
  {
    id: 'hazard',
    icon: '⚠️',
    title: 'Road Hazard Ahead',
    description: 'Caution: Gravel, deep potholes or debris. Drop speed.',
    urgency: 'high',
  },
  {
    id: 'toll',
    icon: '🛑',
    title: 'Toll Gate - Keep Left',
    description: 'Toll plaza approaching. Bikes stay in extreme left lane.',
    urgency: 'medium',
  },
  {
    id: 'rain',
    icon: '🌧️',
    title: 'Rain Incoming - Gear Up',
    description: 'Clouds gathering. Pulling over under shelter to gear up.',
    urgency: 'medium',
  },
  {
    id: 'diversion',
    icon: '🔀',
    title: 'Route Diversion - Follow Lead',
    description: 'Nav change. Do not split at the upcoming fork.',
    urgency: 'high',
  },
  {
    id: 'chai',
    icon: '☕',
    title: 'Chai & Stretch Break (15m)',
    description: 'Stopping at next dhaba/tea stall on the left.',
    urgency: 'info',
  },
];

interface CaptainAnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendAnnouncement: (announcement: { title: string; message: string; urgency: string; icon: string }) => Promise<void>;
}

export default function CaptainAnnouncementModal({
  isOpen,
  onClose,
  onSendAnnouncement,
}: CaptainAnnouncementModalProps) {
  const [selectedId, setSelectedId] = useState<string>('regroup');
  const [customText, setCustomText] = useState('');
  const [sending, setSending] = useState(false);

  if (!isOpen) return null;

  const handleBroadcast = async () => {
    setSending(true);
    try {
      const preset = ANNOUNCEMENT_PRESETS.find((p) => p.id === selectedId);
      const title = preset ? preset.title : 'Captain Announcement';
      const message = customText.trim() || (preset ? preset.description : 'Important message from Convoy Captain.');
      const urgency = preset?.urgency || 'medium';
      const icon = preset?.icon || '📢';

      await onSendAnnouncement({ title, message, urgency, icon });
      setCustomText('');
      onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.dragHandle} />

        <div style={styles.header}>
          <div style={{ fontSize: 26 }}>📢</div>
          <div style={{ flex: 1 }}>
            <h3 style={styles.title}>Captain Broadcast</h3>
            <p style={styles.subtitle}>Alerts all riders with sound & high-priority banner</p>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        <div style={styles.presetsList}>
          {ANNOUNCEMENT_PRESETS.map((p) => {
            const isSelected = selectedId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                style={{
                  ...styles.presetBtn,
                  border: isSelected ? '2px solid #f59e0b' : '1px solid #374151',
                  background: isSelected ? 'rgba(245, 158, 11, 0.15)' : '#111827',
                }}
              >
                <span style={{ fontSize: 24, flexShrink: 0 }}>{p.icon}</span>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div style={{ color: isSelected ? '#fbbf24' : '#fff', fontWeight: 700, fontSize: 14 }}>
                    {p.title}
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}>
                    {p.description}
                  </div>
                </div>
                {isSelected && <span style={{ color: '#f59e0b', fontSize: 18, fontWeight: 800 }}>✓</span>}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 14 }}>
          <label style={{ display: 'block', color: '#9ca3af', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            Custom note / Landmark (Optional):
          </label>
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="e.g. 500m past the toll gate on the left"
            style={styles.customInput}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button type="button" onClick={onClose} style={styles.btnCancel}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleBroadcast}
            disabled={sending}
            style={styles.btnBroadcast}
          >
            {sending ? '⏳ Broadcasting...' : '🚨 Broadcast to All Riders'}
          </button>
        </div>
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
    zIndex: 9999,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    animation: 'fadeIn 0.2s ease-out',
  },
  sheet: {
    backgroundColor: '#1f2937',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: '100%',
    maxWidth: 520,
    padding: '16px 20px 32px',
    boxShadow: '0 -10px 30px rgba(0,0,0,0.6)',
    border: '1px solid #374151',
    boxSizing: 'border-box',
    maxHeight: '88vh',
    overflowY: 'auto',
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4b5563',
    margin: '0 auto 16px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 800,
    margin: 0,
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: 12,
    margin: '2px 0 0',
  },
  closeBtn: {
    background: '#374151',
    border: 'none',
    color: '#9ca3af',
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
  presetsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxHeight: '38vh',
    overflowY: 'auto',
    paddingRight: 4,
  },
  presetBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 14px',
    borderRadius: 10,
    cursor: 'pointer',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'all 0.15s ease',
  },
  customInput: {
    width: '100%',
    background: '#111827',
    border: '1px solid #374151',
    borderRadius: 10,
    padding: '10px 14px',
    color: '#fff',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  },
  btnCancel: {
    flex: 1,
    padding: '12px',
    background: '#374151',
    border: 'none',
    borderRadius: 10,
    color: '#9ca3af',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
  },
  btnBroadcast: {
    flex: 2,
    padding: '12px',
    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
    border: 'none',
    borderRadius: 10,
    color: '#111827',
    fontWeight: 800,
    fontSize: 14,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
  },
};
