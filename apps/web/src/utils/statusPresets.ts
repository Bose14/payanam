/**
 * One-Tap Status Presets Engine (Feature G · Communication)
 * 
 * Rules:
 * 1. Rider opens Tell group: One tap on the Ride tab.
 * 2. Rider taps a preset: On my way, Need fuel, Need a break, Behind wait, Lost call me, All good.
 * 3. Sent with name and time: The group sees the preset, the rider, and when it was sent.
 * 4. Delivery shown per rider: A small indicator shows who has received it.
 */

export interface StatusPresetItem {
  id: string;
  label: string;
  altLabels?: string[];
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}

export const RIDER_STATUS_PRESETS: StatusPresetItem[] = [
  {
    id: 'on_my_way',
    label: 'On my way',
    altLabels: ['on my way', 'on the way'],
    icon: '🏍️',
    color: '#10B981',
    bgColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
    description: 'Riding now, heading towards next waypoint',
  },
  {
    id: 'need_fuel',
    label: 'Need fuel',
    altLabels: ['need fuel', 'fuel required'],
    icon: '⛽',
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#F59E0B',
    description: 'Tank low, stopping at next petrol bunk',
  },
  {
    id: 'need_break',
    label: 'Need a break',
    altLabels: ['need a break', 'need break', 'chai break'],
    icon: '☕',
    color: '#F0C23A',
    bgColor: 'rgba(240, 194, 58, 0.15)',
    borderColor: '#F0C23A',
    description: 'Quick tea or stretch rest requested',
  },
  {
    id: 'behind_wait',
    label: 'Behind wait',
    altLabels: ['behind, wait', 'behind wait', 'waiting behind'],
    icon: '⏳',
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#F59E0B',
    description: 'Falling behind convoy, hold pace or wait',
  },
  {
    id: 'lost_call',
    label: 'Lost call me',
    altLabels: ['lost, call me', 'lost call me', 'lost'],
    icon: '📞',
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#EF4444',
    description: 'Missed turn or split, call rider now',
  },
  {
    id: 'all_good',
    label: 'All good',
    altLabels: ['all good', 'rolling smooth', 'ok'],
    icon: '✅',
    color: '#10B981',
    bgColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
    description: 'Cruising smoothly, everything fine',
  },
];

export interface DeliveryReceipt {
  userId: string;
  userName: string;
  timestamp: string;
}

export interface DeliverySummary {
  deliveredCount: number;
  totalCount: number;
  isAllDelivered: boolean;
  deliveredRiderNames: string[];
  pendingRiderNames: string[];
  summaryText: string;
}

/**
 * Checks if a given message is one of the status presets.
 */
export function getPresetInfo(messageText: string): StatusPresetItem | null {
  if (!messageText) return null;
  const cleaned = messageText
    .replace(/^Status update:\s*/i, '')
    .trim()
    .toLowerCase();

  for (const preset of RIDER_STATUS_PRESETS) {
    if (preset.label.toLowerCase() === cleaned) return preset;
    if (preset.altLabels?.some((alt) => alt.toLowerCase() === cleaned)) return preset;
  }
  return null;
}

/**
 * Requirement 4: Calculates per-rider delivery summary for a message.
 */
export function getDeliverySummary(
  receipts: DeliveryReceipt[] | undefined,
  allRiders: Array<{ userId: string; userName: string }>,
  senderId?: string
): DeliverySummary {
  const receiptUserIds = new Set((receipts || []).map((r) => r.userId));
  if (senderId) receiptUserIds.add(senderId);

  // Group members who should receive (excluding sender if needed, or all)
  const targetRiders = allRiders.length > 0
    ? allRiders
    : (receipts || []).map((r) => ({ userId: r.userId, userName: r.userName }));

  const deliveredRiderNames: string[] = [];
  const pendingRiderNames: string[] = [];

  targetRiders.forEach((r) => {
    if (receiptUserIds.has(r.userId)) {
      deliveredRiderNames.push(r.userName);
    } else {
      pendingRiderNames.push(r.userName);
    }
  });

  const totalCount = targetRiders.length;
  const deliveredCount = deliveredRiderNames.length;
  const isAllDelivered = totalCount > 0 && deliveredCount >= totalCount;

  let summaryText = 'Sent';
  if (totalCount === 0) {
    summaryText = deliveredCount > 0 ? `Delivered to ${deliveredCount}` : 'Sent';
  } else if (isAllDelivered) {
    summaryText = `Delivered to all (${deliveredCount}/${totalCount})`;
  } else {
    summaryText = `Delivered to ${deliveredCount} of ${totalCount}`;
  }

  return {
    deliveredCount,
    totalCount,
    isAllDelivered,
    deliveredRiderNames,
    pendingRiderNames,
    summaryText,
  };
}

