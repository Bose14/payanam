import React from 'react';

export interface MeRideSettingsTabProps {
  userName: string;
  userEmail?: string;
  batterySaver: boolean;
  onToggleBatterySaver: (enabled: boolean) => void;
  wakeLockActive?: boolean;
  onToggleWakeLock?: () => void;
  onReturnToRide: () => void;
  onEndRide?: () => void;
  isCaptain?: boolean;
}

export const MeRideSettingsTab: React.FC<MeRideSettingsTabProps> = ({
  userName,
  userEmail,
  batterySaver,
  onToggleBatterySaver,
  wakeLockActive,
  onToggleWakeLock,
  onReturnToRide,
  onEndRide,
  isCaptain,
}) => {
  return (
    <div style={styles.container}>
      {/* Top Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.avatar}>
            {userName ? userName.slice(0, 2).toUpperCase() : 'ME'}
          </div>
          <div>
            <h2 style={styles.userNameTitle}>
              {userName || 'Rider Profile'}
            </h2>
            <p style={styles.userSub}>
              {userEmail || (isCaptain ? 'Convoy Captain' : 'Active Rider')}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onReturnToRide}
          style={styles.backBtn}
        >
          Done
        </button>
      </div>

      <div style={styles.scrollContent}>
        {/* SECTION: Ride Settings (Feature D Signature) */}
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>RIDE SETTINGS</span>
          <span style={styles.sectionBadge}>COCKPIT</span>
        </div>

        {/* Feature D Card: Battery Saver Setting */}
        <div style={styles.settingCard}>
          <div style={styles.settingRow}>
            <div style={styles.settingTextWrap}>
              <div style={styles.settingLabelWrap}>
                <span style={styles.settingIcon}>🔋</span>
                <span style={styles.settingTitle}>Battery saver</span>
              </div>
              <p style={styles.settingSub}>
                Positions are sent about every 30 s instead of about every 10 s. Preserves phone battery on full-day rides.
              </p>
            </div>

            {/* Custom Toggle Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={batterySaver}
              onClick={() => onToggleBatterySaver(!batterySaver)}
              style={{
                ...styles.switchTrack,
                backgroundColor: batterySaver ? '#F0C23A' : '#2A2E35',
              }}
            >
              <div
                style={{
                  ...styles.switchThumb,
                  transform: batterySaver ? 'translateX(22px)' : 'translateX(2px)',
                }}
              />
            </button>
          </div>

          {/* Dynamic note explaining status */}
          <div style={{
            ...styles.settingFooterNote,
            borderColor: batterySaver ? 'rgba(240, 194, 58, 0.3)' : '#2A2E35',
            backgroundColor: batterySaver ? 'rgba(240, 194, 58, 0.08)' : '#16191D',
          }}>
            <span style={{ color: batterySaver ? '#F0C23A' : '#9D9C9A', fontWeight: 700 }}>
              {batterySaver
                ? '⚡ Active rate: 30s · The Ride tab shows a note that positions may be older.'
                : '⚡ Standard rate: 10s · Real-time high accuracy telemetry.'}
            </span>
          </div>
        </div>

        {/* Screen On / Wake Lock Setting */}
        {onToggleWakeLock && (
          <div style={styles.settingCard}>
            <div style={styles.settingRow}>
              <div style={styles.settingTextWrap}>
                <div style={styles.settingLabelWrap}>
                  <span style={styles.settingIcon}>🔆</span>
                  <span style={styles.settingTitle}>Keep screen awake</span>
                </div>
                <p style={styles.settingSub}>
                  Prevents screen from turning off while mounted on your handlebar.
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={Boolean(wakeLockActive)}
                onClick={onToggleWakeLock}
                style={{
                  ...styles.switchTrack,
                  backgroundColor: wakeLockActive ? '#10B981' : '#2A2E35',
                }}
              >
                <div
                  style={{
                    ...styles.switchThumb,
                    transform: wakeLockActive ? 'translateX(22px)' : 'translateX(2px)',
                  }}
                />
              </button>
            </div>
          </div>
        )}

        {/* SECTION: Convoy Controls */}
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>SESSION CONTROLS</span>
        </div>

        <div style={styles.actionCard}>
          <button
            type="button"
            onClick={onReturnToRide}
            style={styles.primaryActionBtn}
          >
            🗺️ Return to Ride Map
          </button>

          {isCaptain && onEndRide && (
            <button
              type="button"
              onClick={onEndRide}
              style={styles.dangerActionBtn}
            >
              🏁 End Ride for Convoy
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#111316',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px 14px',
    borderBottom: '1px solid #1F2228',
    backgroundColor: '#16191D',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#1B1E23',
    border: '1.5px solid #F0C23A',
    color: '#F0C23A',
    fontWeight: 900,
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userNameTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 900,
    color: '#F1EFEA',
    letterSpacing: '-0.02em',
  },
  userSub: {
    margin: '2px 0 0',
    fontSize: 12,
    color: '#9D9C9A',
    fontWeight: 600,
  },
  backBtn: {
    padding: '7px 16px',
    backgroundColor: '#2A2E35',
    color: '#F1EFEA',
    border: 'none',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
  },
  scrollContent: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: '12px 4px 8px',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 900,
    color: '#9D9C9A',
    letterSpacing: '0.08em',
  },
  sectionBadge: {
    fontSize: 9.5,
    fontWeight: 800,
    color: '#F0C23A',
    backgroundColor: 'rgba(240, 194, 58, 0.12)',
    padding: '2px 6px',
    borderRadius: 6,
  },
  settingCard: {
    backgroundColor: '#1B1E23',
    border: '1.5px solid #2A2E35',
    borderRadius: 18,
    padding: '16px',
    marginBottom: 12,
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
  },
  settingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  settingTextWrap: {
    minWidth: 0,
    flex: 1,
  },
  settingLabelWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  settingIcon: {
    fontSize: 16,
  },
  settingTitle: {
    fontSize: 14.5,
    fontWeight: 800,
    color: '#F1EFEA',
    letterSpacing: '-0.01em',
  },
  settingSub: {
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
    transition: 'background-color 0.2s ease',
    flexShrink: 0,
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
    transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  settingFooterNote: {
    marginTop: 12,
    padding: '8px 12px',
    borderRadius: 10,
    border: '1px solid #2A2E35',
    fontSize: 10.5,
    lineHeight: 1.35,
  },
  actionCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginTop: 8,
  },
  primaryActionBtn: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#F0C23A',
    color: '#111316',
    border: 'none',
    borderRadius: 14,
    fontSize: 13.5,
    fontWeight: 900,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow: '0 4px 14px rgba(240, 194, 58, 0.25)',
  },
  dangerActionBtn: {
    width: '100%',
    padding: '13px',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    color: '#EF4444',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    borderRadius: 14,
    fontSize: 12.5,
    fontWeight: 800,
    cursor: 'pointer',
  },
};

