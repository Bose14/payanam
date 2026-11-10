/**
 * Stop Pinning & Pre-alert Engine (Feature F+I · Stops)
 * 
 * Rules:
 * 1. Captain pins a stop: Live from the Ride tab, or planned in advance in the trip builder.
 * 2. Pre-alert goes out: Members get an alert at a set distance or time before the stop (e.g. 2 km / 5 min).
 * 3. ETA is calculated: Each rider's ETA is shown. Stale riders show unknown, never a guess.
 * 4. Final alert at arrival: Members are alerted when the group reaches the stop.
 */

import { FreshnessInfo } from './lastSeen';

export interface StopPinningConfig {
  preAlertDistanceKm?: number; // Default: 2.0 km
  preAlertMinutes?: number;    // Default: 5 min
  arrivalRadiusKm?: number;     // Default: 0.2 km (200m)
}

export const DEFAULT_PRE_ALERT_KM = 2.0;
export const DEFAULT_PRE_ALERT_MINUTES = 5;
export const DEFAULT_ARRIVAL_RADIUS_KM = 0.2; // 200m

export type StopApproachStage = 'far' | 'approaching' | 'arrived';

export interface StopApproachEvaluation {
  stage: StopApproachStage;
  distanceKm: number | null;
  etaMinutes: number | null;
  etaFormatted: string;
  isApproaching: boolean;
  isArrived: boolean;
  alertText: string;
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
 * Calculates honest ETA for a rider according to Feature A & F+I rules:
 * Stale riders show unknown, never a guess!
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

  // Stale (> 30s) or unknown (> 5min): NEVER GUESS
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
