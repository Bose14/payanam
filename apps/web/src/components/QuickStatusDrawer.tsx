import React from 'react';

export interface QuickStatusOption {
  value: string;
  label: string;
  icon: string;
  color: string;
  bg: string;
  description: string;
}

export const ONE_TAP_STATUS_OPTIONS: QuickStatusOption[] = [
  {
    value: '🟢 Rolling Smooth',
    label: 'Rolling Smooth',
    icon: '🟢',
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.15)',
    description: 'All good, maintaining cruising pace',
  },
  {
    value: '⛽ Need Fuel',
    label: 'Need Fuel',
    icon: '⛽',
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.15)',
    description: 'Reserve light on, need next petrol pump',
  },
  {
    value: '☕ Chai / Snack Break',
    label: 'Chai Break',
    icon: '☕',
    color: '#8b5cf6',
    bg: 'rgba(139, 92, 246, 0.15)',
    description: 'Requesting quick tea / stretch regroup',
  },
  {
    value: '⚠️ Pulling Over',
    label: 'Pulling Over',
    icon: '⚠️',
    color: '#f97316',
    bg: 'rgba(249, 115, 22, 0.15)',
    description: 'Slowing down, stopping at safe shoulder',
  },
  {
    value: '🛑 Mechanical / Puncture',
    label: 'Bike Issue / Flat',
    icon: '🛑',
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.15)',
    description: 'Mechanical emergency or puncture',
  },
  {
    value: '🌧️ Rain / Gearing Up',
    label: 'Rain / Gear Up',
    icon: '🌧️',
    color: '#06b6d4',
    bg: 'rgba(6, 182, 212, 0.15)',
    description: 'Stopping under cover to wear rain suit',
  },
  {
    value: '📸 Scenic Photo Stop',
    label: 'Photo Stop',
    icon: '📸',
    color: '#ec4899',
    bg: 'rgba(236, 72, 153, 0.15)',
    description: 'Pausing 2 mins for viewpoint photos',
  },
  {
    value: '🚦 Split at Junction',
    label: 'Split at Junction',
    icon: '🚦',
    color: '#eab308',
    bg: 'rgba(234, 179, 8, 0.15)',
    description: 'Caught at red light or took wrong turn',
  },
];

interface QuickStatusDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentStatus: string;
  onSelectStatus: (status: string) => void;
}

export default function QuickStatusDrawer({
  isOpen,
  onClose,
  currentStatus,
  onSelectStatus,
}: QuickStatusDrawerProps) {
  if (!isOpen) return null;

  const handleSelect = (status: string) => {
    // Play light haptic / audio feedback
    try {
      if (window.navigator?.vibrate) window.navigator.vibrate(30);
    } catch { /* silent */ }
    onSelectStatus(status);
    onClose();
  };

  return (
    <div style={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.dragHandle} />

        <div style={styles.header}>
          <div style={{ fontSize: 24 }}>⚡</div>
          <div style={{ flex: 1 }}>
            <h3 style={styles.title}>One-Tap Rider Status</h3>
            <p style={styles.subtitle}>Instantly updates your convoy marker & notifies group</p>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        <div style={styles.grid}>
          {ONE_TAP_STATUS_OPTIONS.map((opt) => {
            const isActive = currentStatus === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                style={{
                  ...styles.statusCard,
                  background: isActive ? opt.bg : '#111827',
                  borderColor: isActive ? opt.color : '#374151',
                  boxShadow: isActive ? `0 0 12px ${opt.bg}` : 'none',
                }}
              >
                <div style={{ fontSize: 26, marginBottom: 4 }}>{opt.icon}</div>
                <div style={{ color: isActive ? opt.color : '#fff', fontWeight: 700, fontSize: 13 }}>
                  {opt.label}
                </div>
                <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 2, lineHeight: 1.2 }}>
                  {opt.description}
                </div>
              </button>
            );
          })}
        </div>

        {currentStatus && (
          <button
            type="button"
            onClick={() => handleSelect('')}
            style={styles.btnClear}
          >
            🏁 Clear Active Status
          </button>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(4px)',
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
    padding: '16px 18px 32px',
    boxShadow: '0 -10px 25px rgba(0,0,0,0.5)',
    border: '1px solid #374151',
    boxSizing: 'border-box',
    maxHeight: '85vh',
    overflowY: 'auto',
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4b5563',
    margin: '0 auto 14px',
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 10,
  },
  statusCard: {
    padding: '12px 10px',
    borderRadius: 12,
    border: '1px solid #374151',
    textAlign: 'center',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    transition: 'all 0.15s ease',
  },
  btnClear: {
    width: '100%',
    marginTop: 14,
    padding: '12px',
    background: '#374151',
    border: 'none',
    borderRadius: 10,
    color: '#d1d5db',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  },
};

