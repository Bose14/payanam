import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface JoinConvoyModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCode?: string;
}

export const JoinConvoyModal: React.FC<JoinConvoyModalProps> = ({
  isOpen,
  onClose,
  initialCode = '',
}) => {
  const navigate = useNavigate();
  const [inviteCode, setInviteCode] = useState(initialCode);

  useEffect(() => {
    if (isOpen) {
      setInviteCode(initialCode);
    }
  }, [isOpen, initialCode]);

  if (!isOpen) return null;

  const handlePasteCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const trimmed = text.trim();
        const urlMatch = trimmed.match(/\/join\/([A-Za-z0-9_-]+)/i) || trimmed.match(/[?&]code=([A-Za-z0-9_-]+)/i);
        if (urlMatch && urlMatch[1]) {
          setInviteCode(urlMatch[1].toUpperCase());
          return;
        }
        const codeMatch = trimmed.match(/[A-Za-z0-9]{4,12}/);
        if (codeMatch) {
          setInviteCode(codeMatch[0].toUpperCase());
        } else {
          setInviteCode(trimmed.slice(0, 12).toUpperCase());
        }
      }
    } catch {
      // clipboard access unavailable
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    const clean = inviteCode.trim().toUpperCase();
    onClose();
    navigate(`/join/${clean}`);
  };

  return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div style={styles.modalCard} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>🔑</span>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
              Join Convoy Expedition
            </h3>
          </div>
          <button onClick={onClose} style={styles.closeBtn} aria-label="Close modal">
            ✕
          </button>
        </div>

        <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Enter or paste the invite code shared by your convoy organizer:
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              placeholder="e.g. 9QDA6FP5"
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value.toUpperCase())}
              maxLength={12}
              autoFocus
              style={styles.codeInput}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={handlePasteCode}
              title="Paste from clipboard"
              style={styles.pasteBtn}
            >
              📋 Paste
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button type="button" onClick={onClose} style={styles.btnSecondary}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={!inviteCode.trim()}
              style={{
                ...styles.btnPrimary,
                opacity: !inviteCode.trim() ? 0.6 : 1,
                cursor: !inviteCode.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              Join Convoy →
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JoinConvoyModal;

const styles: Record<string, React.CSSProperties> = {
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: 16,
  },
  modalCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-card)',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
    boxSizing: 'border-box',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: 18,
    cursor: 'pointer',
    padding: 4,
    lineHeight: 1,
  },
  codeInput: {
    flex: 1,
    padding: '11px 14px',
    background: 'var(--bg-subtle)',
    border: '1.5px solid var(--border-input)',
    borderRadius: 10,
    color: 'var(--text-primary)',
    fontWeight: 800,
    fontSize: 15,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    outline: 'none',
    boxSizing: 'border-box',
  },
  pasteBtn: {
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border-card)',
    borderRadius: 10,
    padding: '11px 14px',
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--accent-cyan)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
    flexShrink: 0,
  },
  btnPrimary: {
    flex: 1,
    padding: '12px 18px',
    background: 'var(--btn-primary-bg)',
    color: 'var(--btn-primary-text)',
    border: 'none',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  btnSecondary: {
    padding: '12px 18px',
    background: 'var(--bg-subtle)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
};
