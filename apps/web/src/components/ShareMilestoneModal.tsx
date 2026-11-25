import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  TripMilestoneSummary,
  MilestoneCardCustomization,
  DEFAULT_MILESTONE_CUSTOMIZATION,
  BACKDROP_PRESETS,
  formatMilestoneShareText,
} from '../utils/tripMilestones';
import TripMilestoneCard from './TripMilestoneCard';
import Icon from './Icon';

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
        showToast('Shared successfully!');
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
        showToast('Milestone summary copied to clipboard!');
        setTimeout(() => setCopied(false), 2500);
      });
    }
  };

  return createPortal(
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}><Icon name="trophy" /></span>
            <div>
              <h3 style={styles.title}>Share Trip Milestones</h3>
              <p style={styles.subtitle}>
                Celebrate your finished ride and share the route
              </p>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}><Icon name="close" /></button>
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
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.2, color: 'var(--pz-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
              YOUR BADGE
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
            <span style={{ fontSize: 18 }}><Icon name="shield" /></span>
            <div style={{ fontSize: 12, color: 'var(--pz-ok)', lineHeight: 1.4 }}>
              <strong>Privacy rule enforced:</strong> Hidden stops and residential home starting addresses are strictly excluded from the milestone card.
            </div>
          </div>

          {/* Step 2: Rider picks a photo / backdrop preset */}
          <div style={{ marginTop: 16 }}>
            <div style={styles.sectionHeading}>BACKDROP</div>
            <div style={styles.presetsGrid}>
              {BACKDROP_PRESETS.map((p) => {
                const isSelected = customization.backdropPreset === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setCustomization({ ...customization, backdropPreset: p.id })}
                    style={{
                      ...styles.presetBtn,
                      border: isSelected ? `2px solid ${p.accent}` : '1.5px solid var(--pz-line)',
                      backgroundColor: isSelected ? 'var(--pz-warn-bg)' : 'var(--pz-bg)',
                    }}
                  >
                    <span style={{ fontSize: 18 }}><Icon name={p.icon} /></span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--pz-ink)' }}>{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Choose what shows */}
          <div style={{ marginTop: 16 }}>
            <div style={styles.sectionHeading}>SHOW ON THE BADGE</div>
            <div style={styles.togglesGrid}>
              <label style={styles.toggleRow}>
                <input
                  type="checkbox"
                  checked={customization.showDistance}
                  onChange={(e) => setCustomization({ ...customization, showDistance: e.target.checked })}
                  style={styles.checkbox}
                />
                <span style={styles.toggleLabel}>Distance ({summary.totalDistanceKm} km)</span>
              </label>

              <label style={styles.toggleRow}>
                <input
                  type="checkbox"
                  checked={customization.showDays}
                  onChange={(e) => setCustomization({ ...customization, showDays: e.target.checked })}
                  style={styles.checkbox}
                />
                <span style={styles.toggleLabel}>Days ({summary.daysCount})</span>
              </label>

              <label style={styles.toggleRow}>
                <input
                  type="checkbox"
                  checked={customization.showStops}
                  onChange={(e) => setCustomization({ ...customization, showStops: e.target.checked })}
                  style={styles.checkbox}
                />
                <span style={styles.toggleLabel}>Waypoints ({summary.stopsClearedCount})</span>
              </label>

              <label style={styles.toggleRow}>
                <input
                  type="checkbox"
                  checked={customization.showRiders}
                  onChange={(e) => setCustomization({ ...customization, showRiders: e.target.checked })}
                  style={styles.checkbox}
                />
                <span style={styles.toggleLabel}>Co-riders ({summary.coRidersCount})</span>
              </label>

              <label style={styles.toggleRow}>
                <input
                  type="checkbox"
                  checked={customization.showBikeModel}
                  onChange={(e) => setCustomization({ ...customization, showBikeModel: e.target.checked })}
                  style={styles.checkbox}
                />
                <span style={styles.toggleLabel}>Bike ({summary.bikeModel})</span>
              </label>
            </div>
          </div>

          {/* Optional Rider Reflection Quote */}
          <div style={{ marginTop: 16 }}>
            <div style={styles.sectionHeading}>ADD A NOTE (OPTIONAL)</div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--pz-warn)', fontWeight: 800, fontSize: 12 }}>
              <span><Icon name="link" /></span>
              <span>SHARE LINK</span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--pz-muted)', lineHeight: 1.45 }}>
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
                    publish it to Discover first →
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
            <span><Icon name="chat" /></span>
            <span>WhatsApp</span>
          </button>

          <button
            onClick={handleNativeShare}
            style={styles.btnNative}
          >
            <span><Icon name="arrowRight" /></span>
            <span>Share</span>
          </button>

          <button
            onClick={handleCopy}
            style={styles.btnCopy}
          >
            <span><Icon name={copied ? 'check' : 'list'} /></span>
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 100000,
    padding: 0,
  },
  modal: {
    backgroundColor: 'var(--pz-surface)',
    border: '1.5px solid var(--pz-line)',
    borderRadius: '20px 20px 0 0',
    width: '100%',
    maxWidth: 620,
    maxHeight: '92dvh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 -12px 40px rgba(0, 0, 0, 0.25)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '16px 18px 12px',
    borderBottom: '1px solid var(--pz-line)',
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: 'var(--pz-ink)',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  subtitle: {
    margin: '4px 0 0',
    fontSize: 12,
    color: 'var(--pz-muted)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--pz-muted)',
    fontSize: 18,
    cursor: 'pointer',
    padding: 4,
  },
  toastBar: {
    backgroundColor: 'var(--pz-ok)',
    color: 'var(--pz-on-accent)',
    padding: '8px 16px',
    fontSize: 12,
    fontWeight: 900,
    textAlign: 'center',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
  },
  privacyShieldCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'var(--pz-ok-bg)',
    border: '1.5px solid var(--pz-ok-bg)',
    borderRadius: 12,
    padding: '10px 14px',
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 1.2,
    color: 'var(--pz-muted)',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  presetsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 8,
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'var(--pz-bg)',
    border: '1px solid var(--pz-line)',
    borderRadius: 10,
    padding: '8px 12px',
    cursor: 'pointer',
  },
  checkbox: {
    width: 16,
    height: 16,
    accentColor: 'var(--pz-accent)',
    cursor: 'pointer',
  },
  toggleLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--pz-ink)',
  },
  textInput: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 10,
    border: '1.5px solid var(--pz-line)',
    backgroundColor: 'var(--pz-bg)',
    color: 'var(--pz-ink)',
    fontSize: 13,
    outline: 'none',
  },
  step4NoticeBox: {
    marginTop: 18,
    backgroundColor: 'var(--pz-bg)',
    border: '1px dashed var(--pz-line)',
    borderRadius: 12,
    padding: '12px 14px',
  },
  linkButton: {
    background: 'none',
    border: 'none',
    color: 'var(--pz-warn)',
    fontWeight: 800,
    padding: 0,
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px max(14px, env(safe-area-inset-bottom, 14px))',
    borderTop: '1px solid var(--pz-line)',
    backgroundColor: 'var(--pz-surface)',
  },
  btnWhatsApp: {
    flex: 1,
    minWidth: 0,
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
    flex: 1,
    minWidth: 0,
    padding: '10px 16px',
    backgroundColor: 'var(--pz-accent)',
    color: 'var(--pz-on-accent)',
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
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    padding: '10px 12px',
    backgroundColor: 'var(--pz-bg)',
    color: 'var(--pz-ink)',
    border: '1.5px solid var(--pz-line)',
    borderRadius: 10,
    fontWeight: 800,
    fontSize: 13,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
  },
};
