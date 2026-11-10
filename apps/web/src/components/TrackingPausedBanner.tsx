import React from 'react';

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
        <span>⚠️</span>
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
          <span>▶️</span>
          <span>Resume</span>
        </button>

        {onOpenMeSettings && (
          <button
            type="button"
            onClick={onOpenMeSettings}
            style={styles.btnDiagnostics}
            title="Open background tracking diagnostics in Me tab"
          >
            Diagnostics ➔
          </button>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  banner: {
    backgroundColor: '#7F1D1D', // Dark amber/red background
    border: '2px solid #EF4444',
    borderRadius: 16,
    padding: '12px 16px',
    margin: '10px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    boxShadow: '0 8px 24px rgba(239, 68, 68, 0.4)',
    animation: 'pulse 2s infinite',
    zIndex: 1001,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    flexShrink: 0,
  },
  headline: {
    fontSize: 14,
    fontWeight: 900,
    color: '#FEE2E2',
    letterSpacing: 0.2,
  },
  subtext: {
    fontSize: 11,
    color: '#FCA5A5',
    marginTop: 2,
    lineHeight: 1.35,
  },
  actionsWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  btnResume: {
    padding: '7px 14px',
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
  },
  btnDiagnostics: {
    background: 'none',
    border: 'none',
    color: '#FEE2E2',
    fontSize: 11,
    fontWeight: 800,
    cursor: 'pointer',
    padding: '4px',
    textDecoration: 'underline',
  },
};

