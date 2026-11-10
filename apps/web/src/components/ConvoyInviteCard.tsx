import React, { useState } from 'react';

interface ConvoyInviteCardProps {
  inviteCode?: string;
  tripTitle?: string;
  fromPlace?: string;
  toPlace?: string;
}

export default function ConvoyInviteCard({
  inviteCode = 'BLR9X2',
  tripTitle,
  fromPlace,
  toPlace,
}: ConvoyInviteCardProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/join/${inviteCode}`
    : `https://payanam.app/join/${inviteCode}`;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      /* silent */
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      /* silent */
    }
  };

  const handleWhatsAppShare = () => {
    const routeText = fromPlace && toPlace ? `${fromPlace} ➔ ${toPlace}` : (tripTitle || 'Motorcycle Convoy');
    const msg = `🏍️ Join our motorcycle convoy on Payanam!\n\n🗺️ Route: ${routeText}\n🎟️ Convoy Code: ${inviteCode}\n\nTap to join live convoy:\n${shareUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      style={{
        backgroundColor: '#1B1E23',
        borderRadius: 18,
        border: '1.5px solid #2A2E35',
        padding: '16px 18px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 900, color: '#F0C23A', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            CONVOY INVITATION (FEATURE 1A)
          </span>
          <h4 style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 900, color: '#F1EFEA' }}>
            Invite members to itinerary
          </h4>
        </div>
        <span style={{ fontSize: 10, fontWeight: 800, color: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10B981', padding: '2px 6px', borderRadius: 4 }}>
          ONE SHARED PLAN
        </span>
      </div>

      <p style={{ margin: 0, fontSize: 12, color: '#9D9C9A', lineHeight: 1.35 }}>
        Members join with this invitation code or link. Everyone sees the same stops, notes, and live updates.
      </p>

      {/* Code Display Box */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#111316',
          border: '1.5px dashed #3A3F47',
          borderRadius: 14,
          padding: '10px 14px',
        }}
      >
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#9D9C9A', textTransform: 'uppercase' }}>
            Invitation Code
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 2, color: '#F0C23A', marginTop: 1 }}>
            {inviteCode}
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopyCode}
          style={{
            padding: '7px 12px',
            backgroundColor: '#1B1E23',
            border: '1px solid #2A2E35',
            borderRadius: 8,
            color: copiedCode ? '#10B981' : '#F1EFEA',
            fontSize: 11,
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>{copiedCode ? '✓' : '📋'}</span>
          <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
        </button>
      </div>

      {/* Sharing Action Buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={handleCopyLink}
          style={{
            flex: 1,
            padding: '9px 12px',
            backgroundColor: '#111316',
            border: '1px solid #2A2E35',
            borderRadius: 10,
            color: copiedLink ? '#10B981' : '#F1EFEA',
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
          }}
        >
          <span>🔗</span>
          <span>{copiedLink ? 'Link Copied' : 'Copy Link'}</span>
        </button>

        <button
          type="button"
          onClick={handleWhatsAppShare}
          style={{
            flex: 1,
            padding: '9px 12px',
            backgroundColor: 'rgba(37, 211, 102, 0.12)',
            border: '1.5px solid #25D366',
            borderRadius: 10,
            color: '#25D366',
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
          }}
        >
          <span>💬</span>
          <span>WhatsApp</span>
        </button>
      </div>
    </div>
  );
}
