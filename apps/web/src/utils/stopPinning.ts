/**
 * Stop Pinning, Arrival Detection & Missed Stop Engine (Features F+I & J · Stops)
 * 
 * Feature J Requirements:
 * 1. Rider taps I'm here: One tap sends the arrival to everyone.
 * 2. Arrival is also detected: If a rider enters the stop area, the app offers to mark them arrived.
 * 3. Status updates: Each rider's entry changes to here, a time, or unknown.
 * 4. Missed stop prompt: If a rider passes without arriving, the app asks: Did you stop here?
 */

import { FreshnessInfo } from './lastSeen';

export interface StopPinningConfig {
  preAlertDistanceKm?: number; // Default: 2.0 km
  preAlertMinutes?: number;    // Default: 5 min
  arrivalRadiusKm?: number;     // Default: 0.2 km (200m)
  missedThresholdMeters?: number; // Default: 350 meters
}

export const DEFAULT_PRE_ALERT_KM = 2.0;
export const DEFAULT_PRE_ALERT_MINUTES = 5;
export const DEFAULT_ARRIVAL_RADIUS_KM = 0.2; // 200m
export const DEFAULT_MISSED_THRESHOLD_METERS = 350; // 350m past stop

export type StopApproachStage = 'far' | 'approaching' | 'arrived';
export type StopArrivalCategory = 'here' | 'on_the_way' | 'missed' | 'unknown';

export interface StopApproachEvaluation {
  stage: StopApproachStage;
  distanceKm: number | null;
  etaMinutes: number | null;
  etaFormatted: string;
  isApproaching: boolean;
  isArrived: boolean;
  alertText: string;
}

export interface RiderStopArrivalDetail {
  userId: string;
  userName: string;
  isMe: boolean;
  category: StopArrivalCategory;
  badgeLabel: string;
  badgeColor: string;
  badgeBorder: string;
  badgeBg: string;
  etaOrTimestamp: string;
  subtext: string;
  distanceKm?: number | null;
  arrivedAt?: string;
  isStaleOrUnknown: boolean;
}

/**
 * Calculates whether a rider is far, approaching (within pre-alert threshold), or arrived at a stop.
 */
export function evaluateStopApproach(
  distanceKm: number | null | undefined,
  speedKmh: number = 0,
  isExplicitlyMarkedArrived: boolean = false,
  config?: StopPinningConfig
): StopApproachEvaluation {
  const preAlertDist = config?.preAlertDistanceKm ?? DEFAULT_PRE_ALERT_KM;
  const arrivalDist = config?.arrivalRadiusKm ?? DEFAULT_ARRIVAL_RADIUS_KM;

  if (isExplicitlyMarkedArrived) {
    return {
      stage: 'arrived',
      distanceKm: distanceKm ?? 0,
      etaMinutes: 0,
      etaFormatted: 'HERE',
      isApproaching: false,
      isArrived: true,
      alertText: 'Arrived at stop',
    };
  }

  if (distanceKm == null) {
    return {
      stage: 'far',
      distanceKm: null,
      etaMinutes: null,
      etaFormatted: 'Unknown',
      isApproaching: false,
      isArrived: false,
      alertText: 'Waiting for distance update',
    };
  }

  // 1. Arrival threshold (within 200m)
  if (distanceKm <= arrivalDist) {
    return {
      stage: 'arrived',
      distanceKm,
      etaMinutes: 0,
      etaFormatted: 'HERE',
      isApproaching: false,
      isArrived: true,
      alertText: 'You have reached the stop',
    };
  }

  // Estimated time based on speed or 50 km/h default
  const effectiveSpeed = speedKmh > 10 ? speedKmh : 50;
  const etaMinutes = Math.max(1, Math.round((distanceKm / effectiveSpeed) * 60));

  // 2. Pre-alert threshold (within 2 km or 5 min)
  if (distanceKm <= preAlertDist || etaMinutes <= (config?.preAlertMinutes ?? DEFAULT_PRE_ALERT_MINUTES)) {
    return {
      stage: 'approaching',
      distanceKm,
      etaMinutes,
      etaFormatted: `~${etaMinutes} min`,
      isApproaching: true,
      isArrived: false,
      alertText: `Approaching stop in ${distanceKm.toFixed(1)} km (~${etaMinutes} min)`,
    };
  }

  // 3. Far stage
  return {
    stage: 'far',
    distanceKm,
    etaMinutes,
    etaFormatted: `~${etaMinutes} min`,
    isApproaching: false,
    isArrived: false,
    alertText: `${distanceKm.toFixed(1)} km to stop`,
  };
}

/**
 * Requirement 2: Detects if a rider has entered the stop geofence zone (< 200m).
 */
export function detectArrivalZone(
  distanceKm: number | null | undefined,
  radiusKm: number = DEFAULT_ARRIVAL_RADIUS_KM
): boolean {
  if (distanceKm == null) return false;
  return distanceKm <= radiusKm;
}

/**
 * Requirement 4: Detects if a rider has passed the stop along the route without marking arrived.
 */
export function detectMissedStop(params: {
  riderProgressMeters?: number;
  stopProgressMeters?: number;
  distanceToStopKm: number | null | undefined;
  minDistanceRecordedKm: number;
  isArrived: boolean;
  isDismissed?: boolean;
  thresholdMeters?: number;
}): boolean {
  const {
    riderProgressMeters,
    stopProgressMeters,
    distanceToStopKm,
    minDistanceRecordedKm,
    isArrived,
    isDismissed = false,
    thresholdMeters = DEFAULT_MISSED_THRESHOLD_METERS,
  } = params;

  if (isArrived || isDismissed) return false;

  // 1. Primary check using route progress: Rider is > 350m past the stop on the planned line
  if (
    riderProgressMeters != null &&
    stopProgressMeters != null &&
    stopProgressMeters > 0
  ) {
    if (riderProgressMeters > stopProgressMeters + thresholdMeters) {
      return true;
    }
  }

  // 2. Fallback check using proximity: Was within 600m, but is now moving away past 500m
  if (
    distanceToStopKm != null &&
    minDistanceRecordedKm < 0.6 &&
    distanceToStopKm > 0.5 &&
    distanceToStopKm > minDistanceRecordedKm + 0.35
  ) {
    return true;
  }

  return false;
}

/**
 * Requirement 3: Categorizes each rider's entry into:
 * - here (arrived at stop)
 * - on_the_way (a time e.g. ~8 min)
 * - missed (passed without stopping)
 * - unknown (stale / unknown position)
 */
export function categorizeRiderArrival(params: {
  userId: string;
  userName: string;
  isMe: boolean;
  arrivalStatus?: 'arrived' | 'en_route' | 'departed' | 'missed';
  arrivedAt?: string;
  distanceKm?: number | null;
  speedKmh?: number;
  freshness: FreshnessInfo;
  isMissed?: boolean;
}): RiderStopArrivalDetail {
  const {
    userId,
    userName,
    isMe,
    arrivalStatus,
    arrivedAt,
    distanceKm,
    freshness,
    isMissed = false,
  } = params;

  // 1. HERE (Arrived)
  if (arrivalStatus === 'arrived') {
    const timeText = arrivedAt ? `at ${arrivedAt}` : 'Just now';
    return {
      userId,
      userName,
      isMe,
      category: 'here',
      badgeLabel: 'HERE',
      badgeColor: '#10B981',
      badgeBorder: '#10B981',
      badgeBg: 'rgba(16, 185, 129, 0.15)',
      etaOrTimestamp: arrivedAt || 'HERE',
      subtext: `Arrived ${timeText}`,
      distanceKm: 0,
      arrivedAt,
      isStaleOrUnknown: false,
    };
  }

  // 2. MISSED STOP
  if (isMissed || arrivalStatus === 'missed') {
    return {
      userId,
      userName,
      isMe,
      category: 'missed',
      badgeLabel: 'PASSED',
      badgeColor: '#EF4444',
      badgeBorder: '#EF4444',
      badgeBg: 'rgba(239, 68, 68, 0.15)',
      etaOrTimestamp: 'Passed stop',
      subtext: 'Rode past without stopping',
      distanceKm,
      isStaleOrUnknown: false,
    };
  }

  // 3. UNKNOWN (Stale position > 30s or unknown > 5min) - NEVER GUESS
  if (freshness.isUnknown || freshness.isStale || distanceKm == null) {
    const owner = isMe ? 'Your' : `${userName}'s`;
    const subtext = freshness.ageSecs === Infinity
      ? 'No position received'
      : `${owner} position is ${freshness.ageLabel} old`;

    return {
      userId,
      userName,
      isMe,
      category: 'unknown',
      badgeLabel: 'UNKNOWN',
      badgeColor: '#9D9C9A',
      badgeBorder: '#3A3F47',
      badgeBg: 'rgba(157, 156, 154, 0.12)',
      etaOrTimestamp: 'Unknown',
      subtext,
      distanceKm,
      isStaleOrUnknown: true,
    };
  }

  // 4. ON THE WAY (A time / ETA)
  const effectiveSpeed = params.speedKmh && params.speedKmh > 10 ? params.speedKmh : 50;
  const etaMinutes = Math.max(1, Math.round((distanceKm / effectiveSpeed) * 60));
  const etaFormatted = `~${etaMinutes} min`;
  const subtext = `${distanceKm.toFixed(1)} km away`;

  return {
    userId,
    userName,
    isMe,
    category: 'on_the_way',
    badgeLabel: `${etaMinutes} MIN`,
    badgeColor: '#F0C23A',
    badgeBorder: '#F0C23A',
    badgeBg: 'rgba(240, 194, 58, 0.15)',
    etaOrTimestamp: etaFormatted,
    subtext,
    distanceKm,
    isStaleOrUnknown: false,
  };
}

/**
 * Formats derived ETA according to Feature A & F+I rules.
 */
export function formatRiderStopETA(
  distanceKm: number | null | undefined,
  freshness: FreshnessInfo,
  isArrived: boolean = false,
  riderName?: string
): { display: string; subtext: string; isUnknown: boolean; isArrived: boolean } {
  if (isArrived) {
    return {
      display: 'HERE',
      subtext: riderName ? `${riderName} is here` : 'You are here!',
      isUnknown: false,
      isArrived: true,
    };
  }

  if (freshness.isUnknown || freshness.isStale || distanceKm == null) {
    const owner = riderName ? `${riderName}'s` : 'Rider';
    const subtext = freshness.ageSecs === Infinity
      ? 'No position received'
      : `${owner} position is ${freshness.ageLabel} old`;

    return {
      display: 'Unknown',
      subtext,
      isUnknown: true,
      isArrived: false,
    };
  }

  const mins = Math.max(1, Math.round((distanceKm / 50) * 60));
  return {
    display: `~${mins} min`,
    subtext: riderName ? `${riderName}'s ETA` : `${distanceKm.toFixed(1)} km away`,
    isUnknown: false,
    isArrived: false,
  };
}
