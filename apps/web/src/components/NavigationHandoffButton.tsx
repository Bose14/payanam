import React from 'react';
import { launchNavigationHandoff, NavigationTargetCoords } from '../utils/navigationHandoff';

interface NavigationHandoffButtonProps {
  target: NavigationTargetCoords | null | undefined;
  label?: string;
  variant?: 'primary' | 'secondary' | 'compact' | 'ghost';
  onOpenModal?: (target: NavigationTargetCoords) => void;
  style?: React.CSSProperties;
}

export default function NavigationHandoffButton({
  target,
  label = 'Open in navigation app',
  variant = 'secondary',
  onOpenModal,
  style,
}: NavigationHandoffButtonProps) {
  if (!target || target.lat == null || target.lng == null) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenModal) {
      onOpenModal(target);
    } else {
      launchNavigationHandoff(target);
    }
  };

  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: '#F0C23A',
          color: '#111316',
          border: 'none',
          boxShadow: '0 2px 8px rgba(240, 194, 58, 0.25)',
        };
      case 'compact':
        return {
          backgroundColor: '#1B1E23',
          color: '#F1EFEA',
          border: '1px solid #2A2E35',
          padding: '6px 12px',
          fontSize: 11,
          borderRadius: 8,
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: '#F0C23A',
          border: 'none',
          padding: 0,
          fontSize: 11,
          textDecoration: 'underline',
        };
      case 'secondary':
      default:
        return {
          backgroundColor: '#1B1E23',
          color: '#F1EFEA',
          border: '1.5px solid #2A2E35',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
        };
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`Open ${target.name || 'stop'} in Google Maps / Navigation`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: variant === 'compact' || variant === 'ghost' ? undefined : '10px 14px',
        borderRadius: variant === 'compact' || variant === 'ghost' ? undefined : 12,
        fontWeight: 800,
        fontSize: variant === 'compact' || variant === 'ghost' ? 11 : 13,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        ...getVariantStyles(),
        ...style,
      }}
    >
      <span>🧭</span>
      <span>{label}</span>
    </button>
  );
}
