import React, { useState } from 'react';

export interface NavigationTarget {
  name: string;
  lat: number;
  lng: number;
}

interface NavigationAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: NavigationTarget | null;
}

export default function NavigationAppModal({ isOpen, onClose, target }: NavigationAppModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !target) return null;

  const { name, lat, lng } = target;

  const handleGoogleMaps = (mode: 'motorcycle' | 'driving' = 'motorcycle') => {
    // Google Maps universal web / app URL with travel mode
    const travelParam = mode === 'motorcycle' ? 'two-wheeler' : 'driving';
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=${travelParam}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  const handleAppleMaps = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const url = isIOS
      ? `maps://?daddr=${lat},${lng}&dirflg=d`
      : `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  const handleWaze = () => {
    const url = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  const handleCopyCoords = async () => {
    try {
      await navigator.clipboard.writeText(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silent */ }
  };

  return (
    <div
      style={styles.backdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Navigation options"
    >
      <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.dragHandle} />

        <div style={styles.header}>
          <div style={{ fontSize: 24 }}>🧭</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={styles.title}>Navigate to Stop</h3>
            <p style={styles.subtitle}>{name}</p>
          </div>
          <button onClick={onClose} style={styles.closeBtn} aria-label="Close">✕</button>
        </div>

        <div style={styles.coordBar}>
          <span style={styles.coordText}>📍 {lat.toFixed(4)}, {lng.toFixed(4)}</span>
          <button onClick={handleCopyCoords} style={styles.copyBtn}>
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>
        </div>

        <div style={styles.appsGrid}>
          {/* Google Maps - 2 Wheeler */}
          <button
            onClick={() => handleGoogleMaps('motorcycle')}
            style={{ ...styles.appBtn, borderColor: '#4285F4', background: 'rgba(66, 133, 244, 0.12)' }}
          >
            <div style={styles.appIcon}>🏍️</div>
            <div style={styles.appInfo}>
              <div style={styles.appName}>Google Maps (Bike)</div>
              <div style={styles.appDesc}>Two-wheeler fastest route & shortcuts</div>
            </div>
            <span style={styles.chevron}>➔</span>
          </button>

          {/* Google Maps - Standard */}
          <button
            onClick={() => handleGoogleMaps('driving')}
            style={styles.appBtn}
          >
            <div style={styles.appIcon}>🗺️</div>
            <div style={styles.appInfo}>
              <div style={styles.appName}>Google Maps (Drive)</div>
              <div style={styles.appDesc}>Standard navigation with live traffic</div>
            </div>
            <span style={styles.chevron}>➔</span>
          </button>

          {/* Apple Maps */}
          <button
            onClick={handleAppleMaps}
            style={styles.appBtn}
          >
            <div style={styles.appIcon}>🍏</div>
            <div style={styles.appInfo}>
              <div style={styles.appName}>Apple Maps</div>
              <div style={styles.appDesc}>Native iOS turn-by-turn guidance</div>
            </div>
            <span style={styles.chevron}>➔</span>
          </button>

          {/* Waze */}
          <button
            onClick={handleWaze}
            style={styles.appBtn}
          >
            <div style={styles.appIcon}>🚙</div>
            <div style={styles.appInfo}>
              <div style={styles.appName}>Waze</div>
              <div style={styles.appDesc}>Community alerts for police & hazards</div>
            </div>
            <span style={styles.chevron}>➔</span>
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
    maxWidth: 500,
    padding: '16px 20px 32px',
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
    margin: '0 auto 16px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 700,
    margin: 0,
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: 13,
    margin: '2px 0 0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
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
  coordBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#111827',
    padding: '8px 12px',
    borderRadius: 8,
    marginBottom: 16,
    border: '1px solid #374151',
  },
  coordText: {
    color: '#9ca3af',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  copyBtn: {
    background: '#374151',
    border: 'none',
    color: '#60a5fa',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  appsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  appBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '12px 16px',
    backgroundColor: '#111827',
    border: '1px solid #374151',
    borderRadius: 12,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s ease',
  },
  appIcon: {
    fontSize: 26,
    width: 38,
    height: 38,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  appInfo: {
    flex: 1,
    minWidth: 0,
  },
  appName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
  },
  appDesc: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 2,
  },
  chevron: {
    color: '#6b7280',
    fontSize: 16,
  },
};

