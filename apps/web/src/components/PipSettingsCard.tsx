import React, { useState } from 'react';
import Icon from './Icon';
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

type Platform = 'android' | 'ios' | 'desktop';

const PLATFORMS: { key: Platform; label: string; icon: string }[] = [
  { key: 'android', label: 'Android', icon: 'phone' },
  { key: 'ios', label: 'iPhone', icon: 'phone' },
  { key: 'desktop', label: 'Computer', icon: 'globe' },
];

const MODES: { key: PipModePreference; title: string; hint: string }[] = [
  { key: 'auto', title: 'Automatic', hint: 'Best option for your device' },
  { key: 'in_app', title: 'Inside Payanam', hint: 'Works on every phone' },
  { key: 'native', title: 'Over other apps', hint: 'Android and computers' },
];

const STEPS: Record<Platform, { meta: string; steps: React.ReactNode[] }> = {
  android: {
    meta: 'Android 8.0 or newer',
    steps: [
      <>Open phone <b>Settings</b>, then <b>Apps</b>, then your browser, then <b>Picture-in-picture</b>, and allow it.</>,
      <>Start a ride, then open Google Maps or Waze. The ride view floats above your navigation.</>,
      <>It shows your speed, riders ahead and behind with distances, and the next stop.</>,
    ],
  },
  ios: {
    meta: 'iPhone & iPad (iOS 14+)',
    steps: [
      <>In iPhone <b>Settings &gt; General &gt; Picture in Picture</b>, ensure <b>Start PiP Automatically</b> is ON.</>,
      <>In Payanam, tap the <b>floating view (👁️)</b> button. Payanam connects to Apple WebKit's native PiP presentation engine.</>,
      <>Swipe up to minimize: the floating convoy HUD stays on screen! If your browser restricts it, Payanam shows the floating HUD inside the app.</>,
    ],
  },
  desktop: {
    meta: 'Chrome or Edge',
    steps: [
      <>Open a ride and click the floating view button.</>,
      <>A small always-on-top window appears and stays visible while you work in other tabs.</>,
    ],
  },
};

export const PipSettingsCard: React.FC<PipSettingsCardProps> = ({ onTestPip, style }) => {
  const [prefs, setPrefs] = useState(() => getPipPreferences());
  const [platform, setPlatform] = useState<Platform>(() => getPlatformType() as Platform);
  const [testActive, setTestActive] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const nativeSupported = isNativePipSupported();

  const toggleAutoOpen = () => setPrefs(savePipPreferences({ autoOpenOnRide: !prefs.autoOpenOnRide }));
  const changeMode = (mode: PipModePreference) => setPrefs(savePipPreferences({ preferredMode: mode }));

  const runTest = () => {
    setTestActive(true);
    setTestResult(null);
    if (onTestPip) {
      onTestPip();
      setTestResult('Floating view opened. Look for the small window on screen.');
    } else if (platform === 'ios') {
      setTestResult('Ready. On iPhone, Payanam connects to Apple WebKit Picture-in-Picture presentation engine.');
    } else if (typeof document !== 'undefined' && document.pictureInPictureEnabled) {
      setTestResult('Your browser supports floating over other apps. Make sure Picture-in-picture is allowed in phone settings.');
    } else {
      setTestResult('Your browser does not allow floating over other apps, so Payanam will show it inside the app.');
    }
    setTimeout(() => setTestActive(false), 2500);
  };

  const guide = STEPS[platform];

  return (
    <div style={{ ...styles.card, ...style }}>
      <div style={styles.headerRow}>
        <div style={styles.iconBox}><Icon name="map" size={20} /></div>
        <div style={styles.textWrap}>
          <div style={styles.title}>Floating ride view</div>
          <p style={styles.subtitle}>
            A small window with your speed, riders ahead and behind, and the next stop. It stays on top of other apps.
          </p>
        </div>
      </div>

      <div style={styles.toggleRow}>
        <div style={{ minWidth: 0 }}>
          <div style={styles.rowTitle}>Open automatically</div>
          <div style={styles.rowHint}>
            {prefs.autoOpenOnRide ? 'Opens when you start or join a ride.' : 'Off. Open it from the ride screen when you need it.'}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={prefs.autoOpenOnRide}
          aria-label="Open the floating ride view automatically"
          onClick={toggleAutoOpen}
          style={{ ...styles.switchTrack, backgroundColor: prefs.autoOpenOnRide ? 'var(--pz-ok)' : 'var(--pz-line)' }}
        >
          <span style={{ ...styles.switchThumb, transform: prefs.autoOpenOnRide ? 'translateX(22px)' : 'translateX(2px)' }} />
        </button>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionLabel}>How it works on your device</div>
        <div role="tablist" style={styles.segTabs}>
          {PLATFORMS.map((p) => {
            const on = platform === p.key;
            return (
              <button
                key={p.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setPlatform(p.key)}
                style={{
                  ...styles.segTabBtn,
                  backgroundColor: on ? 'var(--pz-surface)' : 'transparent',
                  color: on ? 'var(--pz-ink)' : 'var(--pz-muted)',
                  fontWeight: on ? 800 : 600,
                  boxShadow: on ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div style={styles.guideBox}>
          <div style={styles.guideMeta}>
            {platform === 'android' && (nativeSupported ? 'Works over other apps on this device' : 'Shown inside Payanam on this device')}
            {platform !== 'android' && guide.meta}
            {platform === 'android' && <span style={{ float: 'right' }}>{guide.meta}</span>}
          </div>
          <ol style={styles.stepList}>
            {guide.steps.map((st, i) => <li key={i}>{st}</li>)}
          </ol>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionLabel}>Where to show it</div>
        <div role="radiogroup" aria-label="Where to show the floating ride view" style={styles.modeGrid}>
          {MODES.map((m) => {
            const on = prefs.preferredMode === m.key;
            return (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => changeMode(m.key)}
                style={{
                  ...styles.modeBtn,
                  borderColor: on ? 'var(--pz-accent)' : 'var(--pz-line)',
                  backgroundColor: on ? 'var(--pz-warn-bg)' : 'var(--pz-bg)',
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 12.5, color: 'var(--pz-ink)' }}>{m.title}</div>
                <div style={{ fontSize: 10.5, color: 'var(--pz-muted)', marginTop: 2 }}>{m.hint}</div>
              </button>
            );
          })}
        </div>
      </div>

      <button type="button" onClick={runTest} disabled={testActive} style={styles.testBtn}>
        <Icon name={testActive ? 'clock' : 'check'} />
        <span>{testActive ? 'Checking...' : 'Check on this device'}</span>
      </button>

      {testResult && (
        <div style={styles.testResultBox} role="status">
          <Icon name="info" />
          <span>{testResult}</span>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: 'var(--pz-surface)',
    border: '1px solid var(--pz-line)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  headerRow: { display: 'flex', alignItems: 'flex-start', gap: 12 },
  iconBox: {
    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'var(--pz-warn-bg)', color: 'var(--pz-warn)',
  },
  textWrap: { minWidth: 0, flex: 1 },
  title: { fontSize: 16, fontWeight: 800, color: 'var(--pz-ink)', letterSpacing: '-0.01em' },
  subtitle: { margin: '3px 0 0', fontSize: 12.5, color: 'var(--pz-muted)', lineHeight: 1.45 },
  toggleRow: {
    marginTop: 14, padding: '12px 14px', borderRadius: 12,
    backgroundColor: 'var(--pz-bg)', border: '1px solid var(--pz-line)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  },
  rowTitle: { fontSize: 14, fontWeight: 700, color: 'var(--pz-ink)' },
  rowHint: { fontSize: 12, color: 'var(--pz-muted)', marginTop: 2, lineHeight: 1.4 },
  switchTrack: {
    width: 48, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer', position: 'relative',
    display: 'flex', alignItems: 'center', padding: 0, flexShrink: 0, touchAction: 'manipulation',
    transition: 'background-color 0.2s',
  },
  switchThumb: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF',
    boxShadow: '0 2px 4px rgba(0,0,0,0.3)', transition: 'transform 0.2s', display: 'block',
  },
  section: { marginTop: 16 },
  sectionLabel: { fontSize: 12, fontWeight: 800, color: 'var(--pz-muted)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 },
  segTabs: { display: 'flex', gap: 4, backgroundColor: 'var(--pz-line)', padding: 3, borderRadius: 11, marginBottom: 10 },
  segTabBtn: { flex: 1, padding: '8px 4px', border: 'none', borderRadius: 9, fontSize: 13, cursor: 'pointer' },
  guideBox: { backgroundColor: 'var(--pz-bg)', border: '1px solid var(--pz-line)', borderRadius: 12, padding: 12 },
  guideMeta: { fontSize: 12, fontWeight: 700, color: 'var(--pz-ok)', marginBottom: 8 },
  stepList: { margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--pz-ink)', lineHeight: 1.55, display: 'grid', gap: 6 },
  modeGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 },
  modeBtn: {
    padding: '10px 6px', borderRadius: 12, borderWidth: 1.5, borderStyle: 'solid',
    cursor: 'pointer', textAlign: 'center', touchAction: 'manipulation',
  },
  testBtn: {
    marginTop: 16, width: '100%', padding: '12px 14px', backgroundColor: 'var(--pz-accent)', border: 'none',
    color: 'var(--pz-on-accent)', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, touchAction: 'manipulation',
  },
  testResultBox: {
    marginTop: 10, padding: '10px 12px', backgroundColor: 'var(--pz-ok-bg)', border: '1px solid var(--pz-ok)',
    borderRadius: 12, fontSize: 12.5, color: 'var(--pz-ink)', display: 'flex', alignItems: 'flex-start', gap: 8, lineHeight: 1.45,
  },
};

export default PipSettingsCard;
