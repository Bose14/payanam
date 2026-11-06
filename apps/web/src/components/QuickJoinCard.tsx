import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface QuickJoinCardProps {
  onSuccess?: () => void;
  style?: React.CSSProperties;
}

export const QuickJoinCard: React.FC<QuickJoinCardProps> = ({ onSuccess, style }) => {
  const navigate = useNavigate();
  const [inviteCodeInput, setInviteCodeInput] = useState('');

  const handlePasteCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const trimmed = text.trim();
        const urlMatch = trimmed.match(/\/join\/([A-Za-z0-9_-]+)/i) || trimmed.match(/[?&]code=([A-Za-z0-9_-]+)/i);
        if (urlMatch && urlMatch[1]) {
          setInviteCodeInput(urlMatch[1].toUpperCase());
          return;
        }
        const codeMatch = trimmed.match(/[A-Za-z0-9]{4,12}/);
        if (codeMatch) {
          setInviteCodeInput(codeMatch[0].toUpperCase());
        } else {
          setInviteCodeInput(trimmed.slice(0, 12).toUpperCase());
        }
      }
    } catch {
      // clipboard access not permitted or unavailable
    }
  };

  const handleJoinWithCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCodeInput.trim()) return;
    const clean = inviteCodeInput.trim().toUpperCase();
    if (onSuccess) onSuccess();
    navigate(`/join/${clean}`);
  };

  return (
    <div className="dashboard-quick-join" style={{ ...styles.quickJoinCard, ...style }}>
      <div style={styles.quickJoinHeader}>
        <div style={styles.quickJoinBadge}>
          <span style={{ fontSize: 13 }}>🤝</span>
          <span>CONVOY ACCESS</span>
        </div>
        <h3 style={styles.quickJoinTitle}>Have a Convoy Invite Code?</h3>
        <p style={styles.quickJoinSubtitle}>
          Enter the code shared by your convoy leader to join routes, waypoints, and live telemetry
        </p>
      </div>

      <form onSubmit={handleJoinWithCode} className="dashboard-quick-join-form" style={styles.quickJoinForm}>
        <div className="quick-join-input-wrap" style={styles.quickJoinInputWrap}>
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>🔑</span>
          <input
            type="text"
            placeholder="e.g. 9QDA6FP5"
            value={inviteCodeInput}
            onChange={e => setInviteCodeInput(e.target.value.toUpperCase())}
            style={styles.quickJoinInput}
            maxLength={12}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={handlePasteCode}
            title="Paste from clipboard"
            className="quick-join-paste-btn"
            style={styles.quickJoinPasteBtn}
          >
            📋 Paste
          </button>
        </div>
        <button
          type="submit"
          disabled={!inviteCodeInput.trim()}
          className="quick-join-submit-btn"
          style={{
            ...styles.btnPrimary,
            padding: '11px 20px',
            fontSize: 13,
            fontWeight: 800,
            opacity: !inviteCodeInput.trim() ? 0.6 : 1,
            cursor: !inviteCodeInput.trim() ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Join Convoy ➔
        </button>
      </form>
    </div>
  );
};

export default QuickJoinCard;

const styles: Record<string, React.CSSProperties> = {
  quickJoinCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
    flexWrap: 'wrap',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-card)',
    borderLeft: '4px solid var(--accent-gold)',
    borderRadius: 16,
    padding: '16px 20px',
    marginBottom: 24,
    boxShadow: 'var(--card-shadow)',
  },
  quickJoinHeader: {
    flex: 1,
    minWidth: 'min(100%, 260px)',
  },
  quickJoinBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 8px',
    borderRadius: 999,
    background: 'var(--accent-gold-bg)',
    color: 'var(--accent-gold)',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  quickJoinTitle: {
    fontWeight: 800,
    fontSize: 15,
    color: 'var(--text-primary)',
    margin: 0,
    letterSpacing: -0.2,
  },
  quickJoinSubtitle: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    margin: '3px 0 0',
    lineHeight: 1.4,
  },
  quickJoinForm: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
    justifyContent: 'flex-end',
    minWidth: 'min(100%, 280px)',
  },
  quickJoinInputWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'var(--bg-subtle)',
    border: '1.5px solid var(--border-subtle)',
    borderRadius: 12,
    padding: '4px 10px',
    flex: 1,
    minWidth: 160,
  },
  quickJoinInput: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-primary)',
    fontWeight: 800,
    fontSize: 14,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    outline: 'none',
    width: '100%',
    padding: '6px 4px',
    boxSizing: 'border-box',
  },
  quickJoinPasteBtn: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-card)',
    borderRadius: 8,
    padding: '5px 9px',
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--accent-cyan)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
    flexShrink: 0,
  },
  btnPrimary: {
    background: 'var(--btn-primary-bg)',
    color: 'var(--btn-primary-text)',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
};
