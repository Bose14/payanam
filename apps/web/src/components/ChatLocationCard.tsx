import React, { useState } from 'react';
import Icon from './Icon';

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
        backgroundColor: 'var(--pz-bg)',
        border: isConfirmed ? '1.5px solid var(--pz-ok)' : '1.5px dashed var(--pz-line)',
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
            <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--text-primary)' }}>
              {placeName}
            </span>
            {isConfirmed && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: 'var(--pz-ok)',
                  backgroundColor: 'var(--pz-ok-bg)',
                  border: '1px solid var(--pz-ok)',
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
            <span style={{ fontSize: 11, color: 'var(--pz-muted)' }}>
              Shared {formattedTime}
            </span>
            {lat != null && lng != null && (
              <button
                type="button"
                onClick={handleOpenMaps}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--pz-warn)',
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
              backgroundColor: 'var(--pz-surface)',
              border: '1px solid var(--pz-line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            <Icon name="pin" />
          </div>
        )}
      </div>

      {/* Feature L: Open stop in navigation app button */}
      {lat != null && lng != null && (
        <button
          type="button"
          onClick={handleOpenMaps}
          style={{
            width: '100%',
            padding: '8px 12px',
            backgroundColor: 'var(--pz-surface)',
            border: '1.5px solid var(--pz-line)',
            borderRadius: 10,
            color: 'var(--text-primary)',
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'background-color 0.2s',
          }}
        >
          <span><Icon name="compass" /></span>
          <span>Open in navigation app</span>
        </button>
      )}

      {/* Confirmation State & Actions */}
      {isConfirmed ? (
        <div
          style={{
            marginTop: 4,
            padding: '8px 10px',
            backgroundColor: 'var(--pz-ok-bg)',
            border: '1px solid var(--pz-ok)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--pz-ok)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span><Icon name="check" /></span> Confirmed in itinerary
          </span>
          {onViewInPlan && (
            <button
              type="button"
              onClick={onViewInPlan}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--pz-warn)',
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
            backgroundColor: 'var(--pz-accent)',
            color: 'var(--pz-on-accent)',
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
            boxShadow: '0 2px 6px var(--pz-warn-bg)',
            transition: 'background-color 0.2s',
          }}
        >
          <span><Icon name="pin" /></span>
          <span>{confirming ? 'Adding to Itinerary...' : 'Confirm as stop'}</span>
        </button>
      ) : (
        <div
          style={{
            marginTop: 4,
            padding: '7px 10px',
            backgroundColor: 'var(--pz-surface)',
            border: '1px solid var(--pz-line)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11,
            color: 'var(--pz-muted)',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span><Icon name="clock" /></span> Waiting for Captain to confirm as stop
          </span>
          <span style={{ fontWeight: 700, color: 'var(--pz-warn)' }}>Captain only</span>
        </div>
      )}
    </div>
  );
}

