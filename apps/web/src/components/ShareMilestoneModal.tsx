import { useState } from 'react';
import {
  TripMilestoneSummary,
  MilestoneCardCustomization,
  DEFAULT_MILESTONE_CUSTOMIZATION,
  BACKDROP_PRESETS,
  formatMilestoneShareText,
} from '../utils/tripMilestones';
import TripMilestoneCard from './TripMilestoneCard';

interface ShareMilestoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: TripMilestoneSummary;
  onOpenPublishFlow?: () => void;
  onNavigateToDiscover?: (url: string) => void;
}

export default function ShareMilestoneModal({
  isOpen,
  onClose,
  summary,
  onOpenPublishFlow,
  onNavigateToDiscover,
}: ShareMilestoneModalProps) {
  const [customization, setCustomization] = useState<MilestoneCardCustomization>(
    DEFAULT_MILESTONE_CUSTOMIZATION
  );
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const shareText = formatMilestoneShareText(summary, customization);

  // Step 3: Native Share
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Payanam Milestone · ${summary.title}`,
          text: shareText,
          url: summary.publicLink,
        });
        showToast('✓ Shared successfully!');
      } catch (err: unknown) {
        if ((err as Error)?.name !== 'AbortError') {
          handleCopy();
        }
      }
    } else {
      handleCopy();
    }
  };

  // Step 3: Direct WhatsApp Share
  const handleWhatsAppShare = () => {
    const encoded = encodeURIComponent(shareText);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  // Step 3: Copy to clipboard
  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText).then(() => {
        setCopied(true);
        showToast('✓ Milestone summary copied to clipboard!');
        setTimeout(() => setCopied(false), 2500);
      });
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>🏆</span>
            <div>
              <h3 style={styles.title}>Share Trip Milestones</h3>
              <p style={styles.subtitle}>
                Feature 2 · Celebrate completion and share verified route stats
              </p>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <div style={styles.toastBar}>
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Body Content */}
        <div style={styles.body}>
          {/* Card Preview (Live render) */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.2, color: '#9D9C9A', textTransform: 'uppercase', marginBottom: 8 }}>
              COMMEMORATIVE COMPLETION BADGE
            </div>
            <TripMilestoneCard
              summary={summary}
              customization={customization}
              onLinkClick={() => {
                if (summary.publicLink) {
                  onNavigateToDiscover?.(summary.publicLink);
                }
              }}
            />
          </div>

          {/* Privacy Guarantee Note (Step 2 requirement) */}
          <div style={styles.privacyShieldCard}>
            <span style={{ fontSize: 18 }}>🛡️</span>
            <div style={{ fontSize: 12, color: '#10B981', lineHeight: 1.4 }}>
              <strong>Privacy rule enforced:</strong> Hidden stops and residential home starting addresses are strictly excluded from the milestone card.
            </div>
          </div>

          {/* Step 2: Rider picks a photo / backdrop preset */}
          <div style={{ marginTop: 16 }}>
            <div style={styles.sectionHeading}>1. SELECT SCENIC BACKDROP THEME</div>
            <div style={styles.presetsGrid}>
              {BACKDROP_PRESETS.map((p) => {
                const isSelected = customization.backdropPreset === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setCustomization({ ...customization, backdropPreset: p.id })}
                    style={{
                      ...styles.presetBtn,
                      border: isSelected ? `2px solid ${p.accent}` : '1.5px solid #2A2E35',
                      backgroundColor: isSelected ? 'rgba(255,255,255,0.06)' : '#111316',
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{p.icon}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#F1EFEA' }}>{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Choose what shows */}
          <div style={{ marginTop: 16 }}>
            <div style={styles.sectionHeading}>2. CHOOSE WHAT SHOWS ON THE BADGE</div>
            <div style={styles.togglesGrid}>
              <label style={styles.toggleRow}>
                <input
                  type="checkbox"
                  checked={customization.showDistance}
                  onChange={(e) => setCustomization({ ...customization, showDistance: e.target.checked })}
                  style={styles.checkbox}
                />
                <span style={styles.toggleLabel}>Total Distance ({summary.totalDistanceKm} km)</span>
              </label>

              <label style={styles.toggleRow}>
                <input
                  type="checkbox"
                  checked={customization.showDays}
                  onChange={(e) => setCustomization({ ...customization, showDays: e.target.checked })}
                  style={styles.checkbox}
                />
                <span style={styles.toggleLabel}>Days Touring ({summary.daysCount} Days)</span>
              </label>

              <label style={styles.toggleRow}>
                <input
                  type="checkbox"
                  checked={customization.showStops}
                  onChange={(e) => setCustomization({ ...customization, showStops: e.target.checked })}
                  style={styles.checkbox}
                />
                <span style={styles.toggleLabel}>Waypoints Cleared ({summary.stopsClearedCount} Stops)</span>
              </label>

              <label style={styles.toggleRow}>
                <input
                  type="checkbox"
                  checked={customization.showRiders}
                  onChange={(e) => setCustomization({ ...customization, showRiders: e.target.checked })}
                  style={styles.checkbox}
                />
                <span style={styles.toggleLabel}>Convoy Co-Riders ({summary.coRidersCount} Riders)</span>
              </label>

              <label style={styles.toggleRow}>
                <input
                  type="checkbox"
                  checked={customization.showBikeModel}
                  onChange={(e) => setCustomization({ ...customization, showBikeModel: e.target.checked })}
                  style={styles.checkbox}
                />
                <span style={styles.toggleLabel}>Motorcycle Model ({summary.bikeModel})</span>
              </label>
            </div>
          </div>

          {/* Optional Rider Reflection Quote */}
          <div style={{ marginTop: 16 }}>
            <div style={styles.sectionHeading}>3. OPTIONAL RIDER NOTE / REFLECTION</div>
            <input
              type="text"
              value={customization.customNote || ''}
              onChange={(e) => setCustomization({ ...customization, customNote: e.target.value })}
              placeholder="e.g. 40 hairpins conquered without a single puncture!"
              style={styles.textInput}
            />
          </div>

          {/* Step 4: Link leads back explanation */}
          <div style={styles.step4NoticeBox}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#F0C23A', fontWeight: 800, fontSize: 12 }}>
              <span>🔗</span>
              <span>GROWTH & DISCOVER INTEGRATION</span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9D9C9A', lineHeight: 1.45 }}>
              {summary.isPublished ? (
                <>
                  Your milestone link leads directly to your <strong>published Discover itinerary</strong>.
                  Anyone who sees your post can explore your stops and copy the route with one tap!
                </>
              ) : (
                <>
                  This trip is currently private. If you want friends and other riders to be able to copy this itinerary,{' '}
                  <button
                    onClick={() => {
                      onClose();
                      onOpenPublishFlow?.();
                    }}
                    style={styles.linkButton}
                  >
                    publish it to Discover first ➔
                  </button>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Modal Footer Share Actions (Step 3) */}
        <div style={styles.footer}>
          <button
            onClick={handleWhatsAppShare}
            style={styles.btnWhatsApp}
          >
            <span>💬</span>
            <span>WhatsApp</span>
          </button>

          <button
            onClick={handleNativeShare}
            style={styles.btnNative}
          >
            <span>↗️</span>
            <span>Share to Apps</span>
          </button>

          <button
            onClick={handleCopy}
            style={styles.btnCopy}
          >
            <span>{copied ? '✓' : '📋'}</span>
            <span>{copied ? 'Copied' : 'Copy Text'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 16,
  },
  modal: {
    backgroundColor: '#1B1E23',
    border: '1.5px solid #2A2E35',
    borderRadius: 20,
    width: '100%',
    maxWidth: 620,
    maxHeight: '92vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '20px 24px 14px',
    borderBottom: '1px solid #2A2E35',
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: '#F1EFEA',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  subtitle: {
    margin: '4px 0 0',
    fontSize: 12,
    color: '#9D9C9A',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#9D9C9A',
    fontSize: 18,
    cursor: 'pointer',
    padding: 4,
  },
  toastBar: {
    backgroundColor: '#10B981',
    color: '#111316',
    padding: '8px 16px',
    fontSize: 12,
    fontWeight: 900,
    textAlign: 'center',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 24px',
  },
  privacyShieldCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    border: '1.5px solid rgba(16, 185, 129, 0.4)',
    borderRadius: 12,
    padding: '10px 14px',
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 1.2,
    color: '#9D9C9A',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  presetsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: 8,
  },
  presetBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '9px 12px',
    borderRadius: 10,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s ease',
  },
  togglesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 8,
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#111316',
    border: '1px solid #2A2E35',
    borderRadius: 10,
    padding: '8px 12px',
    cursor: 'pointer',
  },
  checkbox: {
    width: 16,
    height: 16,
    accentColor: '#F0C23A',
    cursor: 'pointer',
  },
  toggleLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: '#F1EFEA',
  },
  textInput: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 10,
    border: '1.5px solid #2A2E35',
    backgroundColor: '#111316',
    color: '#F1EFEA',
    fontSize: 13,
    outline: 'none',
  },
  step4NoticeBox: {
    marginTop: 18,
    backgroundColor: '#111316',
    border: '1px dashed #2A2E35',
    borderRadius: 12,
    padding: '12px 14px',
  },
  linkButton: {
    background: 'none',
    border: 'none',
    color: '#F0C23A',
    fontWeight: 800,
    padding: 0,
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '16px 24px',
    borderTop: '1px solid #2A2E35',
    backgroundColor: '#1B1E23',
    flexWrap: 'wrap',
  },
  btnWhatsApp: {
    flex: 1,
    minWidth: 120,
    padding: '10px 16px',
    backgroundColor: '#25D366',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 10,
    fontWeight: 900,
    fontSize: 13,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnNative: {
    flex: 1.2,
    minWidth: 130,
    padding: '10px 16px',
    backgroundColor: '#F0C23A',
    color: '#111316',
    border: 'none',
    borderRadius: 10,
    fontWeight: 900,
    fontSize: 13,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnCopy: {
    padding: '10px 16px',
    backgroundColor: '#111316',
    color: '#F1EFEA',
    border: '1.5px solid #2A2E35',
    borderRadius: 10,
    fontWeight: 800,
    fontSize: 13,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
};
