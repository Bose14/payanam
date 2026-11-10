import React from 'react';

export interface OfflineSignalBannerProps {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  justSynced?: boolean;
  onForceSync?: () => void;
  onSimulateToggle?: () => void;
}

export const OfflineSignalBanner: React.FC<OfflineSignalBannerProps> = ({
  isOnline,
  pendingCount,
  isSyncing,
  justSynced = false,
  onForceSync,
}) => {
  // If online, not syncing, and nothing pending or recently synced, banner sits quietly hidden
  if (isOnline && pendingCount === 0 && !isSyncing && !justSynced) {
    return null;
  }

  // STATE 1: Signal restored & syncing queued fixes in batches
  if (isSyncing) {
    return (
      <div style={styles.syncBanner}>
        <div style={styles.contentLeft}>
          <div style={styles.syncIconWrap}>
            <span style={styles.syncSpinner}>🔄</span>
          </div>
          <div style={styles.textWrap}>
            <div style={styles.syncTitle}>
              Signal restored · Syncing {pendingCount > 0 ? `${pendingCount} saved position${pendingCount === 1 ? '' : 's'}` : 'positions'}...
            </div>
            <div style={styles.syncSub}>
              Uploading queued fixes in sequence order
            </div>
          </div>
        </div>
        <span style={styles.syncPill}>
          BATCH SYNC
        </span>
      </div>
    );
  }

  // STATE 2: Just synced confirmation
  if (justSynced && isOnline && pendingCount === 0) {
    return (
      <div style={styles.justSyncedBanner}>
        <div style={styles.contentLeft}>
          <div style={styles.successIconWrap}>✓</div>
          <div style={styles.textWrap}>
            <div style={styles.successTitle}>All positions synced</div>
            <div style={styles.syncSub}>Group map has caught up with your trail</div>
          </div>
        </div>
      </div>
    );
  }

  // STATE 3: No signal — exactly matching the design spec
  // "Runs in the background. The only visible part is the Ride banner: No signal. Your position is saved and will sync."
  return (
    <div style={styles.noSignalBanner}>
      <div style={styles.contentLeft}>
        <div style={styles.warningIconWrap}>
          📡
        </div>
        <div style={styles.textWrap}>
          <div style={styles.noSignalTitle}>
            No signal. Your position is saved and will sync.
          </div>
          <div style={styles.noSignalSub}>
            Fixes write directly to local phone storage
          </div>
        </div>
      </div>

      <div style={styles.actionWrap}>
        {pendingCount > 0 && (
          <span style={styles.savedPill}>
            {pendingCount} saved
          </span>
        )}
        {onForceSync && isOnline && (
          <button
            type="button"
            onClick={onForceSync}
            style={styles.retryBtn}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  noSignalBanner: {
    margin: '4px 12px 8px',
    padding: '9px 14px',
    borderRadius: 16,
    backgroundColor: '#1B1E23',
    border: '1.5px solid #F0C23A',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.45)',
    zIndex: 900,
  },
  syncBanner: {
    margin: '4px 12px 8px',
    padding: '9px 14px',
    borderRadius: 16,
    backgroundColor: '#1B1E23',
    border: '1.5px solid #10B981',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.45)',
    zIndex: 900,
  },
  justSyncedBanner: {
    margin: '4px 12px 8px',
    padding: '8px 14px',
    borderRadius: 16,
    backgroundColor: '#1B1E23',
    border: '1px solid #10B981',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
    zIndex: 900,
  },
  contentLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
    flex: 1,
  },
  warningIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: 'rgba(240, 194, 58, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    color: '#F0C23A',
    flexShrink: 0,
  },
  syncIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    color: '#10B981',
    flexShrink: 0,
  },
  successIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 900,
    color: '#10B981',
    flexShrink: 0,
  },
  syncSpinner: {
    display: 'inline-block',
  },
  textWrap: {
    minWidth: 0,
    flex: 1,
  },
  noSignalTitle: {
    fontSize: 12.5,
    fontWeight: 800,
    color: '#F1EFEA',
    letterSpacing: '-0.01em',
    lineHeight: 1.25,
  },
  noSignalSub: {
    fontSize: 10.5,
    fontWeight: 600,
    color: '#9D9C9A',
    marginTop: 1,
  },
  syncTitle: {
    fontSize: 12.5,
    fontWeight: 800,
    color: '#10B981',
    letterSpacing: '-0.01em',
    lineHeight: 1.25,
  },
  syncSub: {
    fontSize: 10.5,
    fontWeight: 600,
    color: '#9D9C9A',
    marginTop: 1,
  },
  successTitle: {
    fontSize: 12,
    fontWeight: 800,
    color: '#10B981',
  },
  actionWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  savedPill: {
    fontSize: 10,
    fontWeight: 800,
    color: '#F0C23A',
    backgroundColor: 'rgba(240, 194, 58, 0.12)',
    border: '1px solid #F0C23A',
    padding: '3px 8px',
    borderRadius: 12,
    whiteSpace: 'nowrap',
    letterSpacing: '0.02em',
  },
  syncPill: {
    fontSize: 9.5,
    fontWeight: 900,
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    border: '1px solid #10B981',
    padding: '3px 7px',
    borderRadius: 10,
    whiteSpace: 'nowrap',
    letterSpacing: '0.04em',
  },
  retryBtn: {
    fontSize: 10,
    fontWeight: 700,
    color: '#F1EFEA',
    backgroundColor: '#2A2E35',
    border: 'none',
    padding: '4px 8px',
    borderRadius: 8,
    cursor: 'pointer',
  },
};

