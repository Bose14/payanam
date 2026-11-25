import React, { useState } from 'react';
import Icon from './Icon';

interface TripChatWhatsAppBannerProps {
  whatsAppGroupLink?: string;
  tripTitle?: string;
}

export default function TripChatWhatsAppBanner({
  whatsAppGroupLink,
  tripTitle,
}: TripChatWhatsAppBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const defaultWaLink = whatsAppGroupLink || 'https://chat.whatsapp.com';

  return (
    <div
      style={{
        backgroundColor: 'var(--pz-surface)',
        border: '1.5px solid var(--pz-line)',
        borderRadius: 14,
        padding: '10px 14px',
        margin: '0 0 10px 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: 'var(--pz-warn-bg)',
            border: '1px solid var(--pz-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          <Icon name="bike" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 900,
                color: 'var(--pz-warn)',
                letterSpacing: 0.6,
                textTransform: 'uppercase',
              }}
            >
              Trip-Only Chat
            </span>
            <span style={{ fontSize: 11, color: 'var(--pz-muted)', fontWeight: 600 }}>
              Linked to itinerary
            </span>
          </div>
          <p
            style={{
              fontSize: 12,
              color: 'var(--text-primary)',
              margin: '2px 0 0',
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            Coordinate stops & route alerts here. General banter stays on WhatsApp.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <a
          href={defaultWaLink}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open WhatsApp for ${tripTitle || 'Trip'}`}
          style={{
            padding: '6px 12px',
            backgroundColor: 'rgba(37, 211, 102, 0.12)',
            border: '1.5px solid #25D366',
            borderRadius: 10,
            color: '#25D366',
            fontSize: 12,
            fontWeight: 800,
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            transition: 'background-color 0.2s',
          }}
        >
          <span><Icon name="chat" /></span>
          <span>WhatsApp</span>
        </a>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--pz-muted)',
            fontSize: 14,
            cursor: 'pointer',
            padding: '4px 6px',
            borderRadius: 6,
          }}
          title="Dismiss note"
        >
          <Icon name="close" />
        </button>
      </div>
    </div>
  );
}

