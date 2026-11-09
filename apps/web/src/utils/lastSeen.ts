/**
 * Last-seen indicator and Freshness Evaluation Engine
 * 
 * Rules:
 * - Position arrives: Each rider's last accepted position carries its device timestamp.
 * - Age is worked out:
 *   - Under 30 s: 'live' (Solid active marker, live ETA)
 *   - 30 s to 5 min: 'stale' (Hollow marker, age label e.g. "2 min ago")
 *   - Over 5 min: 'unknown' (Dimmed hollow marker, derived ETAs show "Unknown")
 * - Derived values follow: An ETA or arrival that depends on a stale position shows unknown, not a guess.
 * - Thresholds are configurable.
 */

export type FreshnessStatus = 'live' | 'stale' | 'unknown';

export interface FreshnessConfig {
  liveThresholdMs?: number;  // Default: 30,000 ms (30 seconds)
  staleThresholdMs?: number; // Default: 300,000 ms (5 minutes)
}

export interface FreshnessInfo {
  status: FreshnessStatus;
  ageMs: number;
  ageSecs: number;
  ageLabel: string;
  isLive: boolean;
  isStale: boolean;
  isUnknown: boolean;
  badgeLabel: string;
  badgeTextColor: string;
  badgeBorderColor: string;
  badgeBgColor: string;
  markerType: 'solid' | 'hollow' | 'dimmed';
}

export const DEFAULT_LIVE_THRESHOLD_MS = 30 * 1000;      // 30 seconds
export const DEFAULT_STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export function formatAgeString(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return 'unknown';
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${Math.floor(seconds)}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Calculates real-time freshness from a device/server ISO timestamp.
 */
export function getFreshness(
  timestamp?: string | Date | number | null,
  config?: FreshnessConfig
): FreshnessInfo {
  if (!timestamp) {
    return {
      status: 'unknown',
      ageMs: Infinity,
      ageSecs: Infinity,
      ageLabel: 'no position',
      isLive: false,
      isStale: false,
      isUnknown: true,
      badgeLabel: 'UNKNOWN',
      badgeTextColor: '#9ca3af',
      badgeBorderColor: '#4b5563',
      badgeBgColor: 'rgba(75, 85, 99, 0.15)',
      markerType: 'dimmed',
    };
  }

  const timeMs = typeof timestamp === 'number'
    ? timestamp
    : new Date(timestamp).getTime();

  if (isNaN(timeMs)) {
    return {
      status: 'unknown',
      ageMs: Infinity,
      ageSecs: Infinity,
      ageLabel: 'invalid time',
      isLive: false,
      isStale: false,
      isUnknown: true,
      badgeLabel: 'UNKNOWN',
      badgeTextColor: '#9ca3af',
      badgeBorderColor: '#4b5563',
      badgeBgColor: 'rgba(75, 85, 99, 0.15)',
      markerType: 'dimmed',
    };
  }

  const now = Date.now();
  const ageMs = Math.max(0, now - timeMs);
  const ageSecs = Math.floor(ageMs / 1000);
  const ageLabel = formatAgeString(ageSecs);

  const liveCutoff = config?.liveThresholdMs ?? DEFAULT_LIVE_THRESHOLD_MS;
  const staleCutoff = config?.staleThresholdMs ?? DEFAULT_STALE_THRESHOLD_MS;

  if (ageMs < liveCutoff) {
    return {
      status: 'live',
      ageMs,
      ageSecs,
      ageLabel,
      isLive: true,
      isStale: false,
      isUnknown: false,
      badgeLabel: 'LIVE',
      badgeTextColor: '#10b981',
      badgeBorderColor: '#10b981',
      badgeBgColor: 'rgba(16, 185, 129, 0.12)',
      markerType: 'solid',
    };
  }

  if (ageMs <= staleCutoff) {
    return {
      status: 'stale',
      ageMs,
      ageSecs,
      ageLabel,
      isLive: false,
      isStale: true,
      isUnknown: false,
      badgeLabel: 'STALE',
      badgeTextColor: '#f59e0b',
      badgeBorderColor: '#f59e0b',
      badgeBgColor: 'rgba(245, 158, 11, 0.12)',
      markerType: 'hollow',
    };
  }

  return {
    status: 'unknown',
    ageMs,
    ageSecs,
    ageLabel,
    isLive: false,
    isStale: false,
    isUnknown: true,
    badgeLabel: 'UNKNOWN',
    badgeTextColor: '#9ca3af',
    badgeBorderColor: '#6b7280',
    badgeBgColor: 'rgba(107, 114, 128, 0.12)',
    markerType: 'dimmed',
  };
}

/**
 * Derived values rule:
 * An ETA or arrival that depends on a stale/unknown position shows "Unknown", not a guess.
 */
export function formatDerivedETA(
  etaMinutes: number | null | undefined,
  freshness: FreshnessInfo,
  riderName?: string
): { display: string; subtext: string; isUnknown: boolean } {
  // If position is stale (> 30s) or unknown (> 5min), DO NOT GUESS ETA
  if (freshness.isUnknown || freshness.isStale || etaMinutes == null) {
    const ownerName = riderName ? `${riderName}'s` : 'Rider';
    const subtext = freshness.ageSecs === Infinity
      ? 'No position received'
      : `${ownerName} position is ${freshness.ageLabel} old`;

    return {
      display: 'Unknown',
      subtext,
      isUnknown: true,
    };
  }

  return {
    display: etaMinutes < 1 ? '< 1 min' : `~${Math.round(etaMinutes)} min`,
    subtext: riderName ? `${riderName}'s ETA` : 'Your ETA',
    isUnknown: false,
  };
}

/**
 * Formats verified dates for nearby help / amenities (e.g. "VERIFIED 3 DAYS AGO")
 */
export function formatVerifiedAge(timestamp?: string | Date | number | null): string {
  if (!timestamp) return 'UNVERIFIED';
  const ageMs = Date.now() - new Date(timestamp).getTime();
  if (isNaN(ageMs) || ageMs < 0) return 'RECENTLY VERIFIED';
  const days = Math.floor(ageMs / (24 * 3600 * 1000));
  if (days < 1) return 'VERIFIED TODAY';
  if (days === 1) return 'VERIFIED YESTERDAY';
  if (days < 30) return `VERIFIED ${days} DAYS AGO`;
  const months = Math.floor(days / 30);
  return `VERIFIED ${months} ${months === 1 ? 'MONTH' : 'MONTHS'} AGO`;
}

