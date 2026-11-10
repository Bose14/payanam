import React, { useState } from 'react';
import {
  launchNavigationHandoff,
  NAVIGATION_APP_OPTIONS,
  NavigationAppType,
  getPreferredNavigationApp,
  setPreferredNavigationApp,
} from '../utils/navigationHandoff';

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
  const [preferredApp, setPreferredAppState] = useState<NavigationAppType>(getPreferredNavigationApp());

  if (!isOpen || !target) return null;

  const { name, lat, lng } = target;

  const handleLaunch = (appType: NavigationAppType) => {
    setPreferredNavigationApp(appType);
    setPreferredAppState(appType);
    launchNavigationHandoff({ lat, lng, name }, appType);
    onClose();
  };

  const handleCopyCoords = async () => {
    try {
      await navigator.clipboard.writeText(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* silent */
    }
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

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerIcon}>🧭</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={styles.title}>Open in navigation app</h3>
            <p style={styles.subtitle}>{name || 'Destination / Stop'}</p>
          </div>
          <button onClick={onClose} style={styles.closeBtn} aria-label="Close">✕</button>
        </div>

        {/* Coordinates bar */}
        <div style={styles.coordBar}>
          <span style={styles.coordText}>📍 {lat.toFixed(5)}, {lng.toFixed(5)}</span>
          <button onClick={handleCopyCoords} style={styles.copyBtn}>
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>
        </div>

        <p style={styles.hintText}>
          Coordinates handed over to your preferred navigation app. Turn-by-turn guidance happens there.
        </p>

        {/* Apps List */}
        <div style={styles.appsGrid}>
          {NAVIGATION_APP_OPTIONS.map((opt) => {
            const isPreferred = preferredApp === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => handleLaunch(opt.id)}
                style={{
                  ...styles.appBtn,
                  borderColor: isPreferred ? opt.accentColor : '#2A2E35',
                  backgroundColor: isPreferred ? opt.accentBg : '#1B1E23',
                }}
              >
                <div style={styles.appIcon}>{opt.icon}</div>
                <div style={styles.appInfo}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={styles.appName}>{opt.name}</span>
                    {isPreferred && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 900,
                          color: opt.accentColor,
                          border: `1px solid ${opt.accentColor}`,
                          padding: '1px 5px',
                          borderRadius: 4,
                          letterSpacing: 0.5,
                        }}
                      >
                        DEFAULT
                      </span>
                    )}
                  </div>
                  <div style={styles.appDesc}>{opt.desc}</div>
                </div>
                <span style={{ ...styles.chevron, color: opt.accentColor }}>➔</span>
              </button>
            );
          })}
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
    backgroundColor: '#111316',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    maxWidth: 500,
    padding: '16px 20px max(32px, calc(env(safe-area-inset-bottom, 0px) + 20px))',
    boxShadow: '0 -10px 30px rgba(0, 0, 0, 0.7)',
    border: '1.5px solid #2A2E35',
    boxSizing: 'border-box',
    maxHeight: '85vh',
    overflowY: 'auto',
  },
  dragHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3A3F47',
    margin: '0 auto 16px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  headerIcon: {
    fontSize: 26,
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(240, 194, 58, 0.12)',
    border: '1px solid #F0C23A',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: {
    color: '#F1EFEA',
    fontSize: 17,
    fontWeight: 900,
    margin: 0,
    letterSpacing: -0.2,
  },
  subtitle: {
    color: '#9D9C9A',
    fontSize: 13,
    fontWeight: 600,
    margin: '2px 0 0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  closeBtn: {
    background: '#1B1E23',
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
  coordBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1B1E23',
    padding: '8px 12px',
    borderRadius: 10,
    marginBottom: 10,
    border: '1px solid #2A2E35',
  },
  coordText: {
    color: '#D4D2CD',
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: 700,
  },
  copyBtn: {
    background: '#111316',
    border: '1px solid #2A2E35',
    color: '#F0C23A',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 800,
    cursor: 'pointer',
  },
  hintText: {
    color: '#9D9C9A',
    fontSize: 12,
    lineHeight: 1.4,
    margin: '0 0 14px',
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
    padding: '12px 14px',
    border: '1.5px solid #2A2E35',
    borderRadius: 14,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s ease',
  },
  appIcon: {
    fontSize: 24,
    width: 36,
    height: 36,
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
    color: '#F1EFEA',
    fontSize: 14,
    fontWeight: 800,
  },
  appDesc: {
    color: '#9D9C9A',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 1.2,
  },
  chevron: {
    fontSize: 14,
    fontWeight: 900,
  },
};
