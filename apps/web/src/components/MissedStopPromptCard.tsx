import React from 'react';
import { PinnedStopData } from './PinStopModal';
import Icon from './Icon';

export interface MissedStopPromptCardProps {
  pinnedStop: PinnedStopData | null;
  onConfirmStopped: () => void;
  onSkipStop: () => void;
  onTurnBack?: () => void;
}

export const MissedStopPromptCard: React.FC<MissedStopPromptCardProps> = ({
  pinnedStop,
  onConfirmStopped,
  onSkipStop,
  onTurnBack,
}) => {
  if (!pinnedStop) return null;

  return (
    <div style={styles.container} role="alert">
      <div style={styles.topRow}>
        <span style={styles.warningIcon}><Icon name="warning" /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.title}>Did you stop at {pinnedStop.name}?</div>
          <div style={styles.desc}>You passed it without marking arrival.</div>
        </div>
      </div>
      <div style={styles.btnRow}>
        <button type="button" onClick={onConfirmStopped} style={styles.primaryBtn}>I stopped</button>
        <button type="button" onClick={onSkipStop} style={styles.secondaryBtn}>Skip</button>
        {onTurnBack && (
          <button type="button" onClick={onTurnBack} style={styles.secondaryBtn} title="Turn back to stop">Turn back</button>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    margin: '0 12px 6px',
    padding: '10px 12px',
    borderRadius: 12,
    borderLeft: '4px solid var(--pz-warn, #F59E0B)',
    border: '1px solid var(--pz-line)',
    borderLeftWidth: 4,
    borderLeftColor: 'var(--pz-warn, #F59E0B)',
    backgroundColor: 'var(--pz-surface)',
    flexShrink: 0,
  },
  topRow: { display: 'flex', alignItems: 'flex-start', gap: 10 },
  warningIcon: { fontSize: 18, color: 'var(--pz-warn, #F59E0B)', display: 'inline-flex', marginTop: 1 },
  title: { fontSize: 14, fontWeight: 800, color: 'var(--pz-ink)', lineHeight: 1.25, overflowWrap: 'anywhere' },
  desc: { fontSize: 12, color: 'var(--pz-muted)', marginTop: 1 },
  btnRow: { display: 'flex', gap: 8, marginTop: 8 },
  primaryBtn: {
    flex: 1.3, padding: '9px 10px', borderRadius: 10, border: 'none', backgroundColor: 'var(--pz-accent)',
    color: 'var(--pz-on-accent)', fontWeight: 800, fontSize: 13, cursor: 'pointer',
  },
  secondaryBtn: {
    flex: 1, padding: '9px 10px', borderRadius: 10, border: '1px solid var(--pz-line)', backgroundColor: 'var(--pz-bg)',
    color: 'var(--pz-ink)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
  },
};
