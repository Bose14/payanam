import React, { useState } from 'react';
import { ItineraryProposal } from '../utils/itineraryProposals';

interface ItineraryProposalCardProps {
  proposal: ItineraryProposal;
  isCaptain: boolean;
  onAccept: (proposal: ItineraryProposal) => Promise<void> | void;
  onDecline: (proposal: ItineraryProposal) => Promise<void> | void;
}

export default function ItineraryProposalCard({
  proposal,
  isCaptain,
  onAccept,
  onDecline,
}: ItineraryProposalCardProps) {
  const [acting, setActing] = useState(false);

  const handleAccept = async () => {
    if (acting) return;
    setActing(true);
    try {
      await onAccept(proposal);
    } finally {
      setActing(false);
    }
  };

  const handleDecline = async () => {
    if (acting) return;
    setActing(true);
    try {
      await onDecline(proposal);
    } finally {
      setActing(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#1B1E23',
        borderRadius: 18,
        border: proposal.status === 'accepted' ? '1.5px solid #10B981' : '1.5px solid #2A2E35',
        padding: '14px 16px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              backgroundColor: '#22262D',
              color: '#F0C23A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: 12,
              border: '1.5px solid #3A3F47',
              flexShrink: 0,
            }}
          >
            {proposal.proposerInitials || proposal.proposerName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#F1EFEA' }}>
              {proposal.proposerName} proposed
            </div>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#F0C23A', marginTop: 1 }}>
              {proposal.title}
            </div>
          </div>
        </div>

        {/* Status Badges */}
        {proposal.status === 'accepted' && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 900,
              color: '#10B981',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid #10B981',
              padding: '2px 8px',
              borderRadius: 6,
              letterSpacing: 0.5,
            }}
          >
            ✓ ACCEPTED
          </span>
        )}
        {proposal.status === 'declined' && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 900,
              color: '#9D9C9A',
              backgroundColor: 'rgba(157, 156, 154, 0.12)',
              border: '1px solid #2A2E35',
              padding: '2px 8px',
              borderRadius: 6,
              letterSpacing: 0.5,
            }}
          >
            DECLINED
          </span>
        )}
      </div>

      {proposal.description && (
        <p style={{ fontSize: 12, color: '#9D9C9A', margin: 0, lineHeight: 1.35 }}>
          {proposal.description}
        </p>
      )}

      {/* Action Buttons for Pending Status */}
      {proposal.status === 'pending' && (
        <>
          {isCaptain ? (
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button
                type="button"
                onClick={handleAccept}
                disabled={acting}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  backgroundColor: '#F0C23A',
                  color: '#111316',
                  border: 'none',
                  borderRadius: 10,
                  fontWeight: 900,
                  fontSize: 13,
                  cursor: acting ? 'not-allowed' : 'pointer',
                  opacity: acting ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  boxShadow: '0 2px 6px rgba(240, 194, 58, 0.25)',
                }}
              >
                <span>✓</span> Accept
              </button>
              <button
                type="button"
                onClick={handleDecline}
                disabled={acting}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  backgroundColor: '#1B1E23',
                  color: '#F1EFEA',
                  border: '1.5px solid #2A2E35',
                  borderRadius: 10,
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: acting ? 'not-allowed' : 'pointer',
                  opacity: acting ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                }}
              >
                <span>✕</span> Decline
              </button>
            </div>
          ) : (
            <div
              style={{
                marginTop: 2,
                padding: '6px 10px',
                backgroundColor: '#111316',
                border: '1px solid #2A2E35',
                borderRadius: 8,
                fontSize: 11,
                color: '#9D9C9A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span>⏳</span> Awaiting Captain approval
              </span>
              <span style={{ color: '#F0C23A', fontWeight: 700 }}>Captain decision</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

