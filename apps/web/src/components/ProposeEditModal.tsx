import React, { useState } from 'react';
import { PROPOSAL_PRESET_SUGGESTIONS } from '../utils/itineraryProposals';

interface ProposeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitProposal: (proposalData: { title: string; description?: string }) => Promise<void> | void;
}

export default function ProposeEditModal({
  isOpen,
  onClose,
  onSubmitProposal,
}: ProposeEditModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmitProposal({
        title: title.trim(),
        description: description.trim() || undefined,
      });
      setTitle('');
      setDescription('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          backgroundColor: '#111316',
          border: '1.5px solid #2A2E35',
          borderRadius: 20,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 18px',
            borderBottom: '1.5px solid #2A2E35',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>💡</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#F1EFEA' }}>
                Propose Itinerary Edit
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9D9C9A' }}>
                Sent to group & subject to Captain approval
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#9D9C9A',
              fontSize: 18,
              cursor: 'pointer',
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Quick Suggestion Chips */}
        <div style={{ padding: '14px 18px 0' }}>
          <label style={{ fontSize: 11, fontWeight: 800, color: '#9D9C9A', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>
            Quick suggestions
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {PROPOSAL_PRESET_SUGGESTIONS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setTitle(preset)}
                style={{
                  padding: '5px 10px',
                  backgroundColor: '#1B1E23',
                  border: '1px solid #2A2E35',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#F1EFEA',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                + {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 800, color: '#9D9C9A', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>
              Proposed Change *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Lunch at 13:30 instead"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#1B1E23',
                border: '1.5px solid #2A2E35',
                borderRadius: 10,
                padding: '10px 12px',
                color: '#F1EFEA',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 800, color: '#9D9C9A', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>
              Reason / Explanation (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Heavy fog on the pass delayed our pace; need fuel earlier."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#1B1E23',
                border: '1.5px solid #2A2E35',
                borderRadius: 10,
                padding: '10px 12px',
                color: '#F1EFEA',
                fontSize: 13,
                outline: 'none',
                resize: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !title.trim()}
            style={{
              width: '100%',
              marginTop: 6,
              padding: '12px',
              backgroundColor: '#F0C23A',
              color: '#111316',
              border: 'none',
              borderRadius: 12,
              fontWeight: 900,
              fontSize: 14,
              cursor: submitting || !title.trim() ? 'not-allowed' : 'pointer',
              opacity: submitting || !title.trim() ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 4px 12px rgba(240, 194, 58, 0.25)',
            }}
          >
            <span>💡</span>
            <span>{submitting ? 'Submitting...' : 'Submit Proposal to Captain'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
