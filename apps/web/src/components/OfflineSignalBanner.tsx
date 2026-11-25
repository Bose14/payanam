import React from 'react';
import Icon from './Icon';

export interface OfflineSignalBannerProps {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  justSynced?: boolean;
  onForceSync?: () => void;
  onSimulateToggle?: () => void;
}

/**
 * Icon-only connectivity indicator for the ride header. Hidden while online with nothing
 * waiting. Offline: a no-signal icon with the number of saved positions; tap to retry the
 * upload. Syncing: a spinner. Just synced: a check mark.
 */
export const OfflineSignalBanner: React.FC<OfflineSignalBannerProps> = ({
  isOnline,
  pendingCount,
  isSyncing,
  justSynced = false,
  onForceSync,
}) => {
  if (isOnline && pendingCount === 0 && !isSyncing && !justSynced) return null;

  let icon = 'signal';
  let color = 'var(--pz-warn)';
  let label = `No signal. ${pendingCount} position${pendingCount === 1 ? '' : 's'} saved and will sync.`;
  let spin = false;
  if (isSyncing) {
    icon = 'refresh'; color = 'var(--pz-ok)'; spin = true;
    label = 'Signal restored. Syncing saved positions.';
  } else if (justSynced && isOnline && pendingCount === 0) {
    icon = 'check'; color = 'var(--pz-ok)';
    label = 'All positions synced.';
  }

  const canRetry = isOnline && !isSyncing && pendingCount > 0 && !!onForceSync;

  return (
    <button
      type="button"
      onClick={canRetry ? onForceSync : undefined}
      title={label}
      aria-label={label}
      style={{
        position: 'relative',
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: 'var(--pz-surface)',
        border: `1.5px solid ${color}`,
        color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        cursor: canRetry ? 'pointer' : 'default',
        padding: 0,
      }}
    >
      <span style={spin ? { display: 'inline-flex', animation: 'pz-spin 1s linear infinite' } : { display: 'inline-flex' }}>
        <Icon name={icon} />
      </span>
      {!isOnline && pendingCount > 0 && (
        <span style={{
          position: 'absolute', top: -6, right: -6, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8,
          backgroundColor: color, color: 'var(--pz-on-accent)', fontSize: 10, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {pendingCount > 99 ? '99+' : pendingCount}
        </span>
      )}
      <style>{'@keyframes pz-spin { to { transform: rotate(360deg); } }'}</style>
    </button>
  );
};
