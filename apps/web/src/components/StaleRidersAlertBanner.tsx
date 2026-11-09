import React from 'react';

interface StaleRidersAlertBannerProps {
  staleCount: number;
  staleRiderNames?: string[];
  onClick?: () => void;
}

export const StaleRidersAlertBanner: React.FC<StaleRidersAlertBannerProps> = ({
  staleCount,
  staleRiderNames = [],
  onClick,
}) => {
  if (staleCount <= 0) return null;

  const namesPreview = staleRiderNames.length > 0
    ? ` (${staleRiderNames.slice(0, 3).join(', ')}${staleRiderNames.length > 3 ? '...' : ''})`
    : '';

  return (
    <div
      onClick={onClick}
      role="alert"
      style={styles.banner}
      title="Click to view rider positions"
    >
      <div style={styles.iconWrap}>
        <span style={{ fontSize: 16 }}>⚠️</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={styles.text}>
          <strong style={{ fontWeight: 800 }}>
            {staleCount} {staleCount === 1 ? 'rider has' : 'riders have'} no recent position
          </strong>
          {namesPreview && <span style={styles.names}>{namesPreview}</span>}
        </p>
        <span style={styles.subtext}>
          Map markers show hollow circles for stale data · tap to view roster
        </span>
      </div>
      <span style={styles.chevron}>›</span>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  banner: {
    margin: '10px 14px 6px',
    padding: '10px 14px',
    borderRadius: 14,
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1.5px solid rgba(245, 158, 11, 0.45)',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'rgba(245, 158, 11, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  text: {
    margin: 0,
    fontSize: 13,
    color: '#fbbf24',
    lineHeight: 1.3,
  },
  names: {
    fontSize: 12,
    color: '#fef3c7',
    fontWeight: 500,
  },
  subtext: {
    display: 'block',
    fontSize: 11,
    color: 'rgba(254, 243, 199, 0.75)',
    marginTop: 2,
  },
  chevron: {
    fontSize: 20,
    color: '#fbbf24',
    fontWeight: 700,
    paddingLeft: 4,
  },
};

export default StaleRidersAlertBanner;
