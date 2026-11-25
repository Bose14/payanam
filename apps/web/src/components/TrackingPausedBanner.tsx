import React from 'react';
import Icon from './Icon';

interface TrackingPausedBannerProps {
  pauseReason?: string;
  onResume: () => void;
  onOpenMeSettings?: () => void;
}

export default function TrackingPausedBanner({
  pauseReason,
  onResume,
  onOpenMeSettings,
}: TrackingPausedBannerProps) {
  return (
    <div style={styles.banner}>
      <div style={styles.iconWrap}>
        <span><Icon name="warning" /></span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={styles.headline}>
          Tracking paused. Reopen Payanam.
        </div>
        <div style={styles.subtext}>
          {pauseReason || 'Positions are no longer being recorded in background. Keep app open or tap resume.'}
        </div>
      </div>

      <div style={styles.actionsWrap}>
        <button
          type="button"
          onClick={onResume}
          style={styles.btnResume}
          title="Resume GPS tracking now"
        >
          <span><Icon name="arrowRight" /></span>
          <span>Resume</span>
        </button>

        {onOpenMeSettings && (
          <button
            type="button"
            onClick={onOpenMeSettings}
            style={styles.btnDiagnostics}
            title="Open background tracking diagnostics in Me tab"
          >
            Diagnostics →
          </button>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  banner: {
    backgroundColor: '#7F1D1D', // Dark amber/red background
    border: '1.5px solid #EF4444',
    borderRadius: 14,
    padding: '8px 12px',
    margin: '4px 12px 6px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    boxShadow: '0 4px 16px rgba(239, 68, 68, 0.35)',
    zIndex: 1001,
    flexShrink: 0,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    flexShrink: 0,
  },
  headline: {
    fontSize: 13,
    fontWeight: 900,
    color: '#FEE2E2',
    letterSpacing: 0.1,
  },
  subtext: {
    fontSize: 11,
    color: '#FCA5A5',
    marginTop: 2,
    lineHeight: 1.3,
  },
  actionsWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  btnResume: {
    minHeight: 36,
    padding: '6px 12px',
    backgroundColor: '#EF4444',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 10,
    fontWeight: 900,
    fontSize: 12,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    touchAction: 'manipulation',
  },
  btnDiagnostics: {
    minHeight: 36,
    background: 'none',
    border: '1px solid rgba(254, 226, 226, 0.3)',
    borderRadius: 10,
    color: '#FEE2E2',
    fontSize: 11,
    fontWeight: 800,
    cursor: 'pointer',
    padding: '4px 8px',
    display: 'flex',
    alignItems: 'center',
    touchAction: 'manipulation',
  },
};

