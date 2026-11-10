import React, { useState } from 'react';

interface ChatLocationCardProps {
  placeName: string;
  lat: number | null;
  lng: number | null;
  note?: string;
  createdAt: string;
  isCaptain: boolean;
  isConfirmed: boolean;
  onConfirmAsStop?: (place: string, lat: number, lng: number, note?: string) => Promise<void>;
  onViewInPlan?: () => void;
  onOpenInMaps?: (lat: number, lng: number, place: string) => void;
}

export default function ChatLocationCard({
  placeName,
  lat,
  lng,
  note,
  createdAt,
  isCaptain,
  isConfirmed,
  onConfirmAsStop,
  onViewInPlan,
  onOpenInMaps,
}: ChatLocationCardProps) {
  const [confirming, setConfirming] = useState(false);

  const formattedTime = new Date(createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleOpenMaps = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lat != null && lng != null) {
      if (onOpenInMaps) {
        onOpenInMaps(lat, lng, placeName);
      } else {
        window.open(
          `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
          '_blank'
        );
      }
    }
  };

  const handleConfirm = async () => {
    if (!onConfirmAsStop || lat == null || lng == null || confirming) return;
    setConfirming(true);
    try {
      await onConfirmAsStop(placeName, lat, lng, note);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div
      style={{
        marginTop: 10,
        padding: '12px 14px',
        backgroundColor: '#111316',
        border: isConfirmed ? '1.5px solid #10B981' : '1.5px dashed #3A3F47',
        borderRadius: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: '#F1EFEA' }}>
              {placeName}
            </span>
            {isConfirmed && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: '#10B981',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid #10B981',
                  padding: '1px 6px',
                  borderRadius: 4,
                  letterSpacing: 0.5,
                }}
              >
                FROM CHAT
              </span>
            )}
          </div>

          {note && (
            <p style={{ fontSize: 12, color: '#D4D2CD', margin: '4px 0 2px', lineHeight: 1.3 }}>
              {note}
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 11, color: '#9D9C9A' }}>
              Shared {formattedTime}
            </span>
            {lat != null && lng != null && (
              <button
                type="button"
                onClick={handleOpenMaps}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#F0C23A',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                open in maps ↗
              </button>
            )}
          </div>
        </div>

        {lat != null && lng != null && (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: '#1B1E23',
              border: '1px solid #2A2E35',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            📍
          </div>
        )}
      </div>

      {/* Confirmation State & Actions */}
      {isConfirmed ? (
        <div
          style={{
            marginTop: 4,
            padding: '8px 10px',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid #10B981',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 800, color: '#10B981', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span>✓</span> Confirmed in itinerary
          </span>
          {onViewInPlan && (
            <button
              type="button"
              onClick={onViewInPlan}
              style={{
                background: 'none',
                border: 'none',
                color: '#F0C23A',
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
                padding: '2px 4px',
              }}
            >
              View in Plan →
            </button>
          )}
        </div>
      ) : isCaptain ? (
        <button
          type="button"
          onClick={handleConfirm}
          disabled={confirming || lat == null || lng == null}
          style={{
            width: '100%',
            marginTop: 4,
            padding: '10px 14px',
            backgroundColor: '#F0C23A',
            color: '#111316',
            border: 'none',
            borderRadius: 10,
            fontWeight: 900,
            fontSize: 13,
            cursor: confirming ? 'not-allowed' : 'pointer',
            opacity: confirming ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            boxShadow: '0 2px 6px rgba(240, 194, 58, 0.25)',
            transition: 'background-color 0.2s',
          }}
        >
          <span>📌</span>
          <span>{confirming ? 'Adding to Itinerary...' : 'Confirm as stop'}</span>
        </button>
      ) : (
        <div
          style={{
            marginTop: 4,
            padding: '7px 10px',
            backgroundColor: '#1B1E23',
            border: '1px solid #2A2E35',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11,
            color: '#9D9C9A',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span>⏳</span> Waiting for Captain to confirm as stop
          </span>
          <span style={{ fontWeight: 700, color: '#F0C23A' }}>Captain only</span>
        </div>
      )}
    </div>
  );
}

