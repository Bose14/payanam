import React from 'react';
import { isStopFromChat, ItineraryStopLike } from '../utils/tripChatItinerary';

interface ItineraryStopItemProps {
  stop: ItineraryStopLike;
  index: number;
  isPinned: boolean;
  onPinStop: (stop: ItineraryStopLike) => void;
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
        return '🍽️';
      case 'rest':
      case 'chai':
        return '☕';
      case 'fuel_stop':
      case 'fuel':
        return '⛽';
      case 'stay':
      case 'hotel':
        return '🏨';
      default:
        return '📌';
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 0',
        borderBottom: '1px solid #22262E',
        gap: 12,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, marginRight: 2 }}>{getStopTypeIcon(stop.item_type)}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#F1EFEA' }}>
            {stop.place}
          </span>

          {/* Feature H2: Distinct 'FROM CHAT' tag */}
          {fromChat && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: '#10B981',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10B981',
                padding: '1px 6px',
                borderRadius: 4,
                letterSpacing: 0.6,
              }}
            >
              FROM CHAT
            </span>
          )}

          {!fromChat && index === 0 && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: '#10B981',
                border: '1px solid #10B981',
                padding: '1px 6px',
                borderRadius: 4,
              }}
            >
              STARTED
            </span>
          )}
        </div>

        <div style={{ fontSize: 11, color: '#9D9C9A', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span>
            {stop.description || `Stop ${index + 1} · Day ${stop.day_number ?? 1}`}
          </span>
          {stop.lat != null && stop.lng != null && onOpenNavigation && (
            <button
              type="button"
              onClick={() => onOpenNavigation(stop)}
              style={{
                padding: '2px 8px',
                backgroundColor: '#111316',
                border: '1px solid #2A2E35',
                borderRadius: 6,
                color: '#F0C23A',
                fontSize: 10,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <span>🧭</span> Open in navigation app
            </button>
          )}
        </div>
      </div>

      <div style={{ flexShrink: 0 }}>
        {isPinned ? (
          <span
            style={{
              fontSize: 10,
              fontWeight: 900,
              color: '#111316',
              backgroundColor: '#F0C23A',
              padding: '4px 8px',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              boxShadow: '0 2px 4px rgba(240, 194, 58, 0.3)',
            }}
          >
            <span>📌</span> PINNED TARGET
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onPinStop(stop)}
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: '#F0C23A',
              backgroundColor: 'rgba(240, 194, 58, 0.12)',
              border: '1px solid #F0C23A',
              padding: '5px 10px',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'background-color 0.2s',
            }}
          >
            <span>📌</span> Pin as next stop
          </button>
        )}
      </div>
    </div>
  );
}

