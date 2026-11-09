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
    margin: '8px 16px 8px',
    padding: '10px 14px',
    borderRadius: 16,
    background: '#1B1E23',
    border: '1.5px solid #F0C23A',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.25)',
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'rgba(240, 194, 58, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  text: {
    margin: 0,
    fontSize: 13,
    color: '#F0C23A',
    lineHeight: 1.3,
  },
  names: {
    fontSize: 12,
    color: '#F1EFEA',
    fontWeight: 500,
  },
  subtext: {
    display: 'block',
    fontSize: 11,
    color: '#9D9C9A',
    marginTop: 2,
  },
  chevron: {
    fontSize: 20,
    color: '#F0C23A',
    fontWeight: 700,
    paddingLeft: 4,
  },
};

export default StaleRidersAlertBanner;
