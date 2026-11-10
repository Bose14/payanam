import React, { useState } from 'react';
import {
  CAPTAIN_ANNOUNCEMENT_PRESETS,
  OPTIONAL_LINE_SUGGESTIONS,
  CAPTAIN_SENT_VIBRATION_PATTERN,
  CaptainAnnouncementPreset,
} from '../utils/captainAnnouncement';

export type AnnouncementPreset = CaptainAnnouncementPreset;
export const ANNOUNCEMENT_PRESETS = CAPTAIN_ANNOUNCEMENT_PRESETS;

interface CaptainAnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendAnnouncement: (announcement: { title: string; message: string; urgency: string; icon: string }) => Promise<void>;
}

interface SpeechRecognitionResultItem {
  transcript: string;
}
interface SpeechRecognitionResultList {
  [index: number]: {
    [index: number]: SpeechRecognitionResultItem;
  };
}
interface SpeechRecognitionEventLike {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: () => void;
  onend: () => void;
  onerror: () => void;
  onresult: (event: SpeechRecognitionEventLike) => void;
  start: () => void;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

export default function CaptainAnnouncementModal({
  isOpen,
  onClose,
  onSendAnnouncement,
}: CaptainAnnouncementModalProps) {
  const [selectedId, setSelectedId] = useState<string>('fuel_next_town');
  const [customText, setCustomText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [sending, setSending] = useState(false);

  if (!isOpen) return null;

  const handleStartDictation = () => {
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Voice dictation is not supported in this browser. Please type or pick a suggested line.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-IN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setCustomText((prev) => (prev ? `${prev} · ${transcript}` : transcript));
        }
      };
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleBroadcast = async () => {
    setSending(true);
    try {
      const preset = CAPTAIN_ANNOUNCEMENT_PRESETS.find((p) => p.id === selectedId) || CAPTAIN_ANNOUNCEMENT_PRESETS[0];
      const title = preset.title;
      const message = customText.trim()
        ? `${preset.description} — "${customText.trim()}"`
        : preset.description;
      const urgency = preset.urgency;
      const icon = preset.icon;

      if ('vibrate' in navigator) {
        navigator.vibrate(CAPTAIN_SENT_VIBRATION_PATTERN);
      }

      await onSendAnnouncement({ title, message, urgency, icon });
      setCustomText('');
      onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
        {/* Drag Handle */}
        <div style={styles.dragHandle} onClick={onClose} />

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.iconDisc}>👑</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.pretitle}>CAPTAIN CONTROL</div>
            <h3 style={styles.title}>Broadcast Announcement</h3>
            <p style={styles.subtitle}>Alerts members with high-priority audio & distinct vibration</p>
          </div>
          <button type="button" onClick={onClose} style={styles.closeBtn} title="Close">✕</button>
        </div>

        {/* 6 Presets List matching Feature K */}
        <div style={styles.presetsList}>
          {CAPTAIN_ANNOUNCEMENT_PRESETS.map((p) => {
            const isSelected = selectedId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                style={{
                  ...styles.presetBtn,
                  border: isSelected ? '1.5px solid #F0C23A' : '1.5px solid #2A2E35',
                  backgroundColor: isSelected ? 'rgba(240, 194, 58, 0.12)' : '#111316',
                }}
              >
                <span style={styles.presetIcon}>{p.icon}</span>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div style={{
                    color: isSelected ? '#F0C23A' : '#F1EFEA',
                    fontWeight: 800,
                    fontSize: 14,
                  }}>
                    {p.title}
                  </div>
                  <div style={{ color: '#9D9C9A', fontSize: 11.5, marginTop: 2, lineHeight: 1.3 }}>
                    {p.description}
                  </div>
                </div>
                {isSelected && (
                  <span style={styles.checkMark}>✓</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Feature K Requirement 3: Optional line added (dictated or chosen) */}
        <div style={styles.optionalSection}>
          <div style={styles.optionalHeader}>
            <label style={styles.optionalLabel}>
              Optional line added (dictated or chosen):
            </label>
            <button
              type="button"
              onClick={handleStartDictation}
              style={{
                ...styles.micBtn,
                backgroundColor: isListening ? '#EF4444' : '#111316',
                borderColor: isListening ? '#EF4444' : '#2A2E35',
                color: isListening ? '#FFFFFF' : '#F0C23A',
              }}
              title="Dictate short text line via speech"
            >
              {isListening ? '🎙️ Listening...' : '🎤 Dictate'}
            </button>
          </div>

          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="e.g. In 2 km · Keep extreme left"
            style={styles.customInput}
          />

          {/* Quick Chosen Suggestions */}
          <div style={styles.suggestionsRow}>
            {OPTIONAL_LINE_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setCustomText(suggestion)}
                style={styles.suggestionChip}
              >
                + {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={styles.btnRow}>
          <button type="button" onClick={onClose} style={styles.btnCancel}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleBroadcast}
            disabled={sending}
            style={styles.btnBroadcast}
          >
            {sending ? '⏳ Broadcasting...' : '📢 Broadcast Announcement'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    backdropFilter: 'blur(5px)',
    WebkitBackdropFilter: 'blur(5px)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    animation: 'fadeIn 0.2s ease-out',
  },
  sheet: {
    backgroundColor: '#1B1E23',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTop: '1.5px solid #2A2E35',
    width: '100%',
    maxWidth: 520,
    padding: '12px 20px 28px',
    boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.6)',
    boxSizing: 'border-box',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#3A3F47',
    margin: '4px auto 12px',
    cursor: 'pointer',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  iconDisc: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(240, 194, 58, 0.15)',
    border: '1.5px solid #F0C23A',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    flexShrink: 0,
  },
  pretitle: {
    fontSize: 9.5,
    fontWeight: 900,
    color: '#F0C23A',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F1EFEA',
    fontSize: 18,
    fontWeight: 900,
    margin: '1px 0 0',
    letterSpacing: -0.2,
  },
  subtitle: {
    color: '#9D9C9A',
    fontSize: 11.5,
    margin: '2px 0 0',
  },
  closeBtn: {
    background: '#111316',
    border: '1.5px solid #2A2E35',
    color: '#9D9C9A',
    borderRadius: '50%',
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
  },
  presetsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxHeight: '36vh',
    overflowY: 'auto',
    paddingRight: 2,
  },
  presetBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    borderRadius: 14,
    cursor: 'pointer',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'all 0.15s ease',
  },
  presetIcon: {
    fontSize: 24,
    lineHeight: 1,
    flexShrink: 0,
  },
  checkMark: {
    color: '#F0C23A',
    fontSize: 18,
    fontWeight: 900,
  },
  optionalSection: {
    marginTop: 14,
    padding: '12px 14px',
    backgroundColor: '#111316',
    borderRadius: 16,
    border: '1.5px solid #2A2E35',
  },
  optionalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  optionalLabel: {
    color: '#9D9C9A',
    fontSize: 11,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  micBtn: {
    padding: '4px 10px',
    borderRadius: 8,
    border: '1px solid',
    fontSize: 11,
    fontWeight: 800,
    cursor: 'pointer',
  },
  customInput: {
    width: '100%',
    backgroundColor: '#1B1E23',
    border: '1.5px solid #2A2E35',
    borderRadius: 10,
    padding: '9px 12px',
    color: '#F1EFEA',
    fontSize: 13,
    fontWeight: 600,
    outline: 'none',
    boxSizing: 'border-box',
  },
  suggestionsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  suggestionChip: {
    padding: '4px 9px',
    borderRadius: 999,
    backgroundColor: '#1B1E23',
    border: '1px solid #3A3F47',
    color: '#F1EFEA',
    fontSize: 10.5,
    fontWeight: 700,
    cursor: 'pointer',
  },
  btnRow: {
    display: 'flex',
    gap: 10,
    marginTop: 16,
  },
  btnCancel: {
    flex: 1,
    padding: '14px',
    backgroundColor: '#111316',
    border: '1.5px solid #2A2E35',
    borderRadius: 14,
    color: '#9D9C9A',
    fontWeight: 800,
    fontSize: 14,
    cursor: 'pointer',
  },
  btnBroadcast: {
    flex: 2,
    padding: '14px',
    backgroundColor: '#F0C23A',
    border: 'none',
    borderRadius: 14,
    color: '#111316',
    fontWeight: 900,
    fontSize: 14,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(240, 194, 58, 0.3)',
  },
};
