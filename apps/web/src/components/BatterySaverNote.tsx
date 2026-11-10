import React from 'react';

export interface BatterySaverNoteProps {
  enabled: boolean;
  onOpenSettings?: () => void;
}

export const BatterySaverNote: React.FC<BatterySaverNoteProps> = ({
  enabled,
  onOpenSettings,
}) => {
  if (!enabled) return null;

  return (
    <div
      style={styles.container}
      onClick={onOpenSettings}
      role={onOpenSettings ? 'button' : undefined}
      title="Tap to manage Ride Settings in Me"
    >
      <div style={styles.contentWrap}>
        <span style={styles.boltIcon}>⚡</span>
        <span style={styles.textPrimary}>
          Battery saver on
        </span>
        <span style={styles.textDivider}>·</span>
        <span style={styles.textSecondary}>
          Positions may be older (30s update rate)
        </span>
      </div>
      {onOpenSettings && (
        <span style={styles.arrowIcon}>›</span>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    margin: '0 16px 6px',
    padding: '6px 12px',
    backgroundColor: '#16191D',
    border: '1px solid #2A2E35',
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  contentWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
    fontSize: 11,
    lineHeight: 1.2,
  },
  boltIcon: {
    fontSize: 12,
    color: '#F0C23A',
    flexShrink: 0,
  },
  textPrimary: {
    fontWeight: 800,
    color: '#F0C23A',
    letterSpacing: '-0.01em',
    flexShrink: 0,
  },
  textDivider: {
    color: '#4B5563',
    fontWeight: 700,
  },
  textSecondary: {
    color: '#9D9C9A',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  arrowIcon: {
    color: '#9D9C9A',
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
  },
};

