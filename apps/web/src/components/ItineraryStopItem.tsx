import React from 'react';
import { isStopFromChat, ItineraryStopLike } from '../utils/tripChatItinerary';
import Icon from './Icon';

interface ItineraryStopItemProps {
  stop: ItineraryStopLike;
  index: number;
  isPinned: boolean;
  /** Captain only. Omit for riders to hide the pin action. */
  onPinStop?: (stop: ItineraryStopLike) => void;
  onOpenNavigation?: (stop: ItineraryStopLike) => void;
}

export default function ItineraryStopItem({
  stop,
  index,
  isPinned,
  onPinStop,
  onOpenNavigation,
}: ItineraryStopItemProps) {
  const fromChat = isStopFromChat(stop);

  const getStopTypeIcon = (type?: string) => {
    switch (type) {
      case 'meal':
      case 'food':
        return 'food';
      case 'rest':
      case 'chai':
        return 'coffee';
      case 'fuel_stop':
      case 'fuel':
        return 'fuel';
      case 'stay':
      case 'hotel':
        return 'bed';
      default:
        return 'pin';
    }
  };

  const tag = (color: string, bg?: string): React.CSSProperties => ({
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 0.6,
    color,
    backgroundColor: bg,
    border: `1px solid ${color}`,
    padding: '1px 6px',
    borderRadius: 999,
    whiteSpace: 'nowrap',
  });
  const subtitle = stop.description || `Day ${stop.day_number ?? 1}`;
  const canNavigate = stop.lat != null && stop.lng != null && onOpenNavigation;

  const roundBtn: React.CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: 999,
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    cursor: 'pointer',
    border: '1px solid var(--pz-line)',
    backgroundColor: 'var(--pz-bg)',
    color: 'var(--pz-ink)',
    touchAction: 'manipulation',
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 0',
        borderBottom: '1px solid var(--pz-line)',
        gap: 10,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          backgroundColor: isPinned ? 'var(--pz-accent)' : 'var(--pz-warn-bg)',
          color: isPinned ? 'var(--pz-on-accent)' : 'var(--pz-warn)',
        }}
      >
        <Icon name={getStopTypeIcon(stop.item_type)} />
      </span>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--pz-ink)', lineHeight: 1.3, overflowWrap: 'anywhere' }}>
          {stop.place}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--pz-muted)', fontWeight: 600 }}>
            Stop {index + 1} · {subtitle}
          </span>
          {isPinned && <span style={tag('var(--pz-warn)', 'var(--pz-warn-bg)')}>NEXT STOP</span>}
          {fromChat && <span style={tag('var(--pz-ok)', 'var(--pz-ok-bg)')}>FROM CHAT</span>}
          {!fromChat && index === 0 && !isPinned && <span style={tag('var(--pz-ok)')}>START</span>}
        </div>
      </div>

      {canNavigate && (
        <button type="button" onClick={() => onOpenNavigation!(stop)} style={roundBtn} aria-label={`Navigate to ${stop.place}`} title="Open in navigation app">
          <Icon name="compass" />
        </button>
      )}
      {onPinStop && !isPinned && (
        <button
          type="button"
          onClick={() => onPinStop(stop)}
          style={{ ...roundBtn, backgroundColor: 'var(--pz-accent)', borderColor: 'var(--pz-accent)', color: 'var(--pz-on-accent)' }}
          aria-label={`Pin ${stop.place} as next stop`}
          title="Pin as next stop"
        >
          <Icon name="pin" />
        </button>
      )}
    </div>
  );
}
