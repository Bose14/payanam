import React from 'react';
import { PinnedStopData } from './PinStopModal';

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
    <div style={styles.container}>
      {/* Header Row */}
      <div style={styles.headerRow}>
        <div style={styles.headerLeft}>
          <span style={styles.warningIcon}>⚠️</span>
          <div>
            <span style={styles.pretitle}>MISSED STOP PROMPT</span>
            <h4 style={styles.title}>Did you stop here?</h4>
          </div>
        </div>
        <span style={styles.badge}>PASSED STOP</span>
      </div>

      {/* Description */}
      <p style={styles.desc}>
        You passed <strong style={{ color: '#F1EFEA' }}>{pinnedStop.name}</strong> without marking arrival. Did you take this break or continue riding?
      </p>

      {/* Action Buttons Row */}
      <div style={styles.btnRow}>
        <button
          type="button"
          onClick={onConfirmStopped}
          style={styles.primaryBtn}
        >
          ✓ Yes, I stopped here
        </button>

        <button
          type="button"
          onClick={onSkipStop}
          style={styles.secondaryBtn}
        >
          Skipped, continuing ahead
        </button>

        {onTurnBack && (
          <button
            type="button"
            onClick={onTurnBack}
            style={styles.turnBackBtn}
            title="Turn back to stop"
          >
            ↩ Turn back
          </button>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    margin: '0 16px 8px 16px',
    padding: '12px 14px',
    borderRadius: 18,
    border: '1.5px solid #F59E0B',
    backgroundColor: '#1B1E23',
    boxShadow: '0 4px 18px rgba(0, 0, 0, 0.4)',
    flexShrink: 0,
    zIndex: 40,
    animation: 'slideDown 0.25s ease-out',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  warningIcon: {
    fontSize: 18,
  },
  pretitle: {
    fontSize: 9,
    fontWeight: 900,
    color: '#F59E0B',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    display: 'block',
  },
  title: {
    margin: '1px 0 0',
    fontSize: 14,
    fontWeight: 900,
    color: '#F1EFEA',
    letterSpacing: -0.2,
  },
  badge: {
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: 0.5,
    padding: '2px 7px',
    borderRadius: 999,
    border: '1px solid #F59E0B',
    color: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    textTransform: 'uppercase',
    flexShrink: 0,
  },
  desc: {
    margin: '6px 0 10px',
    fontSize: 11.5,
    color: '#9D9C9A',
    lineHeight: 1.45,
  },
  btnRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  primaryBtn: {
    flex: 1,
    minWidth: 140,
    padding: '8px 12px',
    borderRadius: 10,
    border: 'none',
    backgroundColor: '#F0C23A',
    color: '#111316',
    fontWeight: 900,
    fontSize: 11.5,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  secondaryBtn: {
    flex: 1,
    minWidth: 140,
    padding: '8px 12px',
    borderRadius: 10,
    border: '1px solid #2A2E35',
    backgroundColor: '#111316',
    color: '#F1EFEA',
    fontWeight: 800,
    fontSize: 11.5,
    cursor: 'pointer',
  },
  turnBackBtn: {
    padding: '8px 10px',
    borderRadius: 10,
    border: '1px solid #2A2E35',
    backgroundColor: '#111316',
    color: '#9D9C9A',
    fontWeight: 800,
    fontSize: 11,
    cursor: 'pointer',
  },
};

