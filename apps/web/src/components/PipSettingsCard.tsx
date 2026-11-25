import React, { useState } from 'react';
import {
  getPipPreferences,
  savePipPreferences,
  getPlatformType,
  isNativePipSupported,
  PipModePreference,
} from '../utils/pipPreferences';

export interface PipSettingsCardProps {
  onTestPip?: () => void;
  style?: React.CSSProperties;
}

export const PipSettingsCard: React.FC<PipSettingsCardProps> = ({ onTestPip, style }) => {
  const [prefs, setPrefs] = useState(() => getPipPreferences());
  const [platformTab, setPlatformTab] = useState<'android' | 'ios' | 'desktop'>(() => getPlatformType());
  const [testActive, setTestActive] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const nativeSupported = isNativePipSupported();

  const handleToggleAutoOpen = (checked: boolean) => {
    const updated = savePipPreferences({ autoOpenOnRide: checked });
    setPrefs(updated);
  };

  const handleModeChange = (mode: PipModePreference) => {
    const updated = savePipPreferences({ preferredMode: mode });
    setPrefs(updated);
  };

  const handleRunTest = async () => {
    setTestActive(true);
    setTestResult(null);

    if (onTestPip) {
      onTestPip();
      setTestResult('PiP HUD triggered. Look for the floating window or ribbon!');
      setTimeout(() => setTestActive(false), 2500);
      return;
    }

    // Direct browser test
    try {
      if (platformTab === 'ios') {
        setTestResult('iOS Mode: In-App Floating Cockpit is fully supported and ready!');
      } else if (document.pictureInPictureEnabled) {
        setTestResult('System PiP is supported on your browser! Ensure phone Settings > Chrome > PiP is Allowed.');
      } else {
        setTestResult('System PiP restricted by browser — will automatically use 60 FPS In-App Floating Ribbon.');
      }
    } catch {
      setTestResult('Ready. 60 FPS Floating In-App HUD will be used.');
    } finally {
      setTimeout(() => setTestActive(false), 3000);
    }
  };

  return (
    <div style={{ ...styles.card, ...style }}>
      {/* Top Setting Row: Auto-open PiP HUD */}
      <div style={styles.headerRow}>
        <div style={styles.textWrap}>
          <div style={styles.titleRow}>
            <span style={styles.icon}>📺</span>
            <span style={styles.title}>Picture-in-Picture (PiP HUD)</span>
            <span style={styles.badgeGreen}>Allowed by default</span>
          </div>
          <p style={styles.subtitle}>
            Allowed by default for all users. 60 FPS floating cockpit telemetry showing live speed, ahead/behind fellow rider spacing, and next stop.
          </p>
        </div>

        {/* Auto Open Switch */}
        <button
          type="button"
          role="switch"
          aria-checked={prefs.autoOpenOnRide}
          onClick={() => handleToggleAutoOpen(!prefs.autoOpenOnRide)}
          style={{
            ...styles.switchTrack,
            backgroundColor: prefs.autoOpenOnRide ? '#10B981' : '#2A2E35',
          }}
          title="Auto-open PiP HUD when entering a ride"
        >
          <div
            style={{
              ...styles.switchThumb,
              transform: prefs.autoOpenOnRide ? 'translateX(22px)' : 'translateX(2px)',
            }}
          />
        </button>
      </div>

      <div style={styles.autoOpenNote}>
        <span style={{ color: prefs.autoOpenOnRide ? '#10B981' : '#9D9C9A', fontWeight: 700, fontSize: 11.5 }}>
          {prefs.autoOpenOnRide
            ? '✓ Allowed & Active by default: 60 FPS PiP HUD opens automatically when you start or join a ride.'
            : 'Off: PiP HUD will only launch when you tap the [📺 PiP HUD] button in the Ride top bar.'}
        </span>
      </div>

      {/* Platform Instructions Selector */}
      <div style={styles.platformSelectorWrap}>
        <div style={styles.platformLabel}>
          <span>PLATFORM PERMISSION & GUIDANCE</span>
        </div>

        <div style={styles.segTabs}>
          <button
            type="button"
            onClick={() => setPlatformTab('android')}
            style={{
              ...styles.segTabBtn,
              backgroundColor: platformTab === 'android' ? '#2A2E35' : 'transparent',
              color: platformTab === 'android' ? '#10B981' : '#9D9C9A',
              fontWeight: platformTab === 'android' ? 800 : 600,
            }}
          >
            🤖 Android
          </button>
          <button
            type="button"
            onClick={() => setPlatformTab('ios')}
            style={{
              ...styles.segTabBtn,
              backgroundColor: platformTab === 'ios' ? '#2A2E35' : 'transparent',
              color: platformTab === 'ios' ? '#F0C23A' : '#9D9C9A',
              fontWeight: platformTab === 'ios' ? 800 : 600,
            }}
          >
            🍎 iPhone / iOS
          </button>
          <button
            type="button"
            onClick={() => setPlatformTab('desktop')}
            style={{
              ...styles.segTabBtn,
              backgroundColor: platformTab === 'desktop' ? '#2A2E35' : 'transparent',
              color: platformTab === 'desktop' ? '#FFFFFF' : '#9D9C9A',
              fontWeight: platformTab === 'desktop' ? 800 : 600,
            }}
          >
            💻 Desktop
          </button>
        </div>

        {/* Content for Android */}
        {platformTab === 'android' && (
          <div style={styles.guideBox}>
            <div style={styles.guideHeader}>
              <span style={styles.badgeGreen}>
                {nativeSupported ? '● System PiP Supported' : '● In-App HUD Ready'}
              </span>
              <span style={{ fontSize: 11, color: '#9D9C9A', fontWeight: 600 }}>Android 8.0+</span>
            </div>

            <ol style={styles.stepList}>
              <li>
                <b>Allow Chrome/Browser PiP:</b> Open phone <i>Settings</i> ➔ <i>Apps</i> ➔ <i>Chrome</i> (or your browser) ➔ <i>Picture-in-picture</i> ➔ select <b>Allowed</b>.
              </li>
              <li>
                <b>Over-Maps Navigation:</b> When riding with Google Maps or Waze, Payanam PiP pops out and hovers over your navigation map.
              </li>
              <li>
                <b>60 FPS Telemetry:</b> Shows live speed, in-front / behind fellow riders with exact distances in meters, and next fuel/food stop.
              </li>
            </ol>
          </div>
        )}

        {/* Content for iOS */}
        {platformTab === 'ios' && (
          <div style={styles.guideBox}>
            <div style={styles.guideHeader}>
              <span style={styles.badgeGold}>
                ● 60 FPS In-App Cockpit Active
              </span>
              <span style={{ fontSize: 11, color: '#9D9C9A', fontWeight: 600 }}>iOS 14+</span>
            </div>

            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#E5E7EB', lineHeight: 1.45 }}>
              Apple's iOS Safari restricts web apps from popping out live canvas streams to the iOS home screen.
              Payanam automatically activates the <b>Floating In-App Ribbon</b>:
            </p>

            <ul style={styles.stepList}>
              <li>
                <b>Floating Glass Cockpit:</b> Displays live speed, ahead/behind rider spacing, and micro convoy rail right on your ride screen.
              </li>
              <li>
                <b>Dock Controls:</b> Use <b>Dock Top</b> or <b>Dock Bottom</b> to place it out of the way of your route.
              </li>
              <li>
                <b>Pro Tip:</b> Tap Safari's <b>Share (↑)</b> ➔ <b>Add to Home Screen</b> to install Payanam for a dedicated, fullscreen app experience.
              </li>
            </ul>
          </div>
        )}

        {/* Content for Desktop */}
        {platformTab === 'desktop' && (
          <div style={styles.guideBox}>
            <div style={styles.guideHeader}>
              <span style={styles.badgeGreen}>● Always-on-Top Window</span>
              <span style={{ fontSize: 11, color: '#9D9C9A', fontWeight: 600 }}>Chrome / Edge</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#E5E7EB', lineHeight: 1.45 }}>
              On desktop, clicking <b>PiP HUD</b> pops out an always-on-top hardware-accelerated floating widget that stays visible while working in other tabs.
            </p>
          </div>
        )}
      </div>

      {/* Mode Preference Selector */}
      <div style={styles.modeSection}>
        <div style={{ fontSize: 11, fontWeight: 900, color: '#9D9C9A', letterSpacing: 0.8, marginBottom: 8 }}>
          HUD DISPLAY MODE
        </div>
        <div style={styles.modeGrid}>
          <button
            type="button"
            onClick={() => handleModeChange('auto')}
            style={{
              ...styles.modeBtn,
              borderColor: prefs.preferredMode === 'auto' ? '#F0C23A' : '#2A2E35',
              backgroundColor: prefs.preferredMode === 'auto' ? 'rgba(240, 194, 58, 0.12)' : '#16191D',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 12, color: prefs.preferredMode === 'auto' ? '#F0C23A' : '#FFFFFF' }}>
              Auto-Detect
            </div>
            <div style={{ fontSize: 10, color: '#9D9C9A', marginTop: 2 }}>
              Best for device
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange('in_app')}
            style={{
              ...styles.modeBtn,
              borderColor: prefs.preferredMode === 'in_app' ? '#F0C23A' : '#2A2E35',
              backgroundColor: prefs.preferredMode === 'in_app' ? 'rgba(240, 194, 58, 0.12)' : '#16191D',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 12, color: prefs.preferredMode === 'in_app' ? '#F0C23A' : '#FFFFFF' }}>
              In-App Ribbon
            </div>
            <div style={{ fontSize: 10, color: '#9D9C9A', marginTop: 2 }}>
              iOS / Reliable
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange('native')}
            style={{
              ...styles.modeBtn,
              borderColor: prefs.preferredMode === 'native' ? '#F0C23A' : '#2A2E35',
              backgroundColor: prefs.preferredMode === 'native' ? 'rgba(240, 194, 58, 0.12)' : '#16191D',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 12, color: prefs.preferredMode === 'native' ? '#F0C23A' : '#FFFFFF' }}>
              System Window
            </div>
            <div style={{ fontSize: 10, color: '#9D9C9A', marginTop: 2 }}>
              Android / PC
            </div>
          </button>
        </div>
      </div>

      {/* Action / Test Button */}
      <div style={{ marginTop: 14 }}>
        <button
          type="button"
          onClick={handleRunTest}
          disabled={testActive}
          style={styles.testBtn}
        >
          <span>{testActive ? '⏳' : '⚡'}</span>
          <span>{testActive ? 'Testing PiP...' : 'Test PiP HUD Permission'}</span>
        </button>

        {testResult && (
          <div style={styles.testResultBox}>
            <span style={{ color: '#10B981', fontWeight: 800 }}>✓</span>
            <span>{testResult}</span>
          </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: '#1B1E23',
    border: '1.5px solid #2A2E35',
    borderRadius: 18,
    padding: '16px',
    marginBottom: 12,
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  textWrap: {
    minWidth: 0,
    flex: 1,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  icon: {
    fontSize: 16,
  },
  title: {
    fontSize: 14.5,
    fontWeight: 800,
    color: 'var(--text-primary)',
    letterSpacing: '-0.01em',
  },
  subtitle: {
    margin: 0,
    fontSize: 11.5,
    color: '#9D9C9A',
    lineHeight: 1.4,
  },
  switchTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    padding: 0,
    flexShrink: 0,
    touchAction: 'manipulation',
    transition: 'background-color 0.2s',
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
    transition: 'transform 0.2s',
  },
  autoOpenNote: {
    marginTop: 10,
    padding: '8px 10px',
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
  },
  platformSelectorWrap: {
    marginTop: 14,
    borderTop: '1px solid #2A2E35',
    paddingTop: 12,
  },
  platformLabel: {
    fontSize: 10.5,
    fontWeight: 900,
    color: '#9D9C9A',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  segTabs: {
    display: 'flex',
    gap: 4,
    backgroundColor: '#14161A',
    padding: 3,
    borderRadius: 10,
    marginBottom: 10,
  },
  segTabBtn: {
    flex: 1,
    padding: '6px 4px',
    border: 'none',
    borderRadius: 8,
    fontSize: 11.5,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  guideBox: {
    backgroundColor: '#14161A',
    border: '1px solid #23272F',
    borderRadius: 12,
    padding: '12px',
  },
  guideHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badgeGreen: {
    fontSize: 10.5,
    fontWeight: 800,
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    padding: '2px 8px',
    borderRadius: 6,
    border: '1px solid rgba(16, 185, 129, 0.3)',
  },
  badgeGold: {
    fontSize: 10.5,
    fontWeight: 800,
    color: '#F0C23A',
    backgroundColor: 'rgba(240, 194, 58, 0.12)',
    padding: '2px 8px',
    borderRadius: 6,
    border: '1px solid rgba(240, 194, 58, 0.3)',
  },
  stepList: {
    margin: 0,
    paddingLeft: 16,
    fontSize: 11.5,
    color: '#D1D5DB',
    lineHeight: 1.5,
  },
  modeSection: {
    marginTop: 14,
    borderTop: '1px solid #2A2E35',
    paddingTop: 12,
  },
  modeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
  },
  modeBtn: {
    padding: '8px 6px',
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'solid',
    cursor: 'pointer',
    textAlign: 'center',
    touchAction: 'manipulation',
  },
  testBtn: {
    width: '100%',
    padding: '10px 14px',
    backgroundColor: 'rgba(240, 194, 58, 0.15)',
    border: '1.5px solid #F0C23A',
    color: '#F0C23A',
    borderRadius: 12,
    fontSize: 12.5,
    fontWeight: 800,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    touchAction: 'manipulation',
  },
  testResultBox: {
    marginTop: 8,
    padding: '8px 12px',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    border: '1px solid #10B981',
    borderRadius: 10,
    fontSize: 11.5,
    color: '#D1FAE5',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
};

export default PipSettingsCard;
