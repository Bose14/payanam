import React from 'react';
import { getPresetInfo, getDeliverySummary, DeliveryReceipt } from '../utils/statusPresets';

export interface PresetCardProps {
  messageId: string;
  senderId: string;
  senderName: string;
  messageText: string;
  createdAt: string;
  isMe: boolean;
  deliveryReceipts?: DeliveryReceipt[];
  allRiders?: Array<{ userId: string; userName: string }>;
  isCaptain?: boolean;
}

export const PresetCard: React.FC<PresetCardProps> = ({
  senderName,
  senderId,
  messageText,
  createdAt,
  isMe,
  deliveryReceipts,
  allRiders = [],
  isCaptain = false,
}) => {
  const preset = getPresetInfo(messageText);
  const delivery = getDeliverySummary(deliveryReceipts, allRiders, senderId);

  // Time formatting
  const timeFormatted = (() => {
    try {
      const d = new Date(createdAt);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Just now';
    }
  })();

  const presetIcon = preset?.icon || '💬';
  const presetLabel = preset?.label || messageText;
  const accentColor = preset?.color || '#F0C23A';
  const bgColor = preset?.bgColor || 'rgba(240, 194, 58, 0.12)';
  const borderColor = preset?.borderColor || '#F0C23A';

  return (
    <div style={{
      ...styles.wrapper,
      alignSelf: isMe ? 'flex-end' : 'flex-start',
      maxWidth: '92%',
      width: '100%',
    }}>
      <div style={{
        ...styles.card,
        borderColor: isMe ? '#F0C23A' : '#2A2E35',
        backgroundColor: '#1B1E23',
      }}>
        {/* Header Row: Sender + Tag + Timestamp */}
        <div style={styles.headerRow}>
          <div style={styles.senderWrap}>
            <span style={styles.senderName}>
              {isMe ? 'You' : senderName}
            </span>
            {isCaptain && (
              <span style={styles.captainBadge}>👑 CAPTAIN</span>
            )}
            <span style={styles.presetTag}>STATUS PRESET</span>
          </div>
          <span style={styles.timeText}>{timeFormatted}</span>
        </div>

        {/* Preset Body Banner */}
        <div style={{
          ...styles.presetBanner,
          backgroundColor: bgColor,
          borderColor,
        }}>
          <span style={styles.presetIcon}>{presetIcon}</span>
          <div style={styles.presetTextWrap}>
            <span style={{ ...styles.presetLabel, color: accentColor }}>
              {presetLabel}
            </span>
            {preset?.description && (
              <span style={styles.presetDesc}>{preset.description}</span>
            )}
          </div>
        </div>

        {/* Feature G Requirement 4: Delivery shown per rider */}
        <div style={styles.deliverySection}>
          <div style={styles.deliveryHeaderRow}>
            <div style={styles.deliverySummaryWrap}>
              <span style={{
                ...styles.doubleCheck,
                color: delivery.isAllDelivered ? '#10B981' : '#F0C23A',
              }}>
                {delivery.isAllDelivered ? '✓✓' : '✓'}
              </span>
              <span style={styles.deliverySummaryText}>
                {delivery.summaryText}
              </span>
            </div>
          </div>

          {/* Per-Rider Small Indicators */}
          {allRiders.length > 0 && (
            <div style={styles.ridersIndicatorList}>
              {allRiders.map((rider) => {
                const hasReceived = delivery.deliveredRiderNames.includes(rider.userName);
                return (
                  <span
                    key={rider.userId}
                    style={{
                      ...styles.riderDeliveryPill,
                      borderColor: hasReceived ? '#10B981' : '#3A3F47',
                      backgroundColor: hasReceived ? 'rgba(16, 185, 129, 0.12)' : '#111316',
                      color: hasReceived ? '#10B981' : '#9D9C9A',
                    }}
                    title={hasReceived ? `Delivered to ${rider.userName}` : `Waiting for ${rider.userName}`}
                  >
                    <span style={styles.riderPillName}>{rider.userName}</span>
                    <span style={styles.riderPillIcon}>{hasReceived ? '✓' : '⏳'}</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    margin: '4px 0',
    display: 'flex',
    flexDirection: 'column',
  },
  card: {
    padding: '12px 14px',
    borderRadius: 18,
    border: '1.5px solid #2A2E35',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  senderWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  senderName: {
    fontSize: 12,
    fontWeight: 800,
    color: '#F1EFEA',
  },
  captainBadge: {
    fontSize: 8.5,
    fontWeight: 900,
    color: '#F0C23A',
    backgroundColor: 'rgba(240, 194, 58, 0.15)',
    padding: '1px 6px',
    borderRadius: 6,
    letterSpacing: 0.5,
  },
  presetTag: {
    fontSize: 8,
    fontWeight: 900,
    color: '#9D9C9A',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  timeText: {
    fontSize: 10.5,
    color: '#9D9C9A',
    fontWeight: 600,
  },
  presetBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    borderRadius: 14,
    border: '1.5px solid',
  },
  presetIcon: {
    fontSize: 24,
    lineHeight: 1,
    flexShrink: 0,
  },
  presetTextWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  presetLabel: {
    fontSize: 16,
    fontWeight: 900,
    letterSpacing: -0.2,
    lineHeight: 1.2,
  },
  presetDesc: {
    fontSize: 11,
    color: '#9D9C9A',
    fontWeight: 600,
  },
  deliverySection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    paddingTop: 4,
    borderTop: '1px solid #22262E',
  },
  deliveryHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deliverySummaryWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },
  doubleCheck: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: -1,
  },
  deliverySummaryText: {
    fontSize: 10,
    fontWeight: 700,
    color: '#9D9C9A',
  },
  ridersIndicatorList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
  },
  riderDeliveryPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 7px',
    borderRadius: 999,
    border: '1px solid',
    fontSize: 9.5,
    fontWeight: 700,
  },
  riderPillName: {
    maxWidth: 70,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  riderPillIcon: {
    fontSize: 9,
    fontWeight: 900,
  },
};

export default PresetCard;
