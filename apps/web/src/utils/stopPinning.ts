/**
 * Stop Pinning, Arrival Detection & Missed Stop Engine (Features F+I & J · Stops)
 * 
 * Feature J Requirements:
 * 1. Rider taps I'm here: One tap sends the arrival to everyone.
 * 2. Arrival is also detected: If a rider enters the stop area, the app offers to mark them arrived.
 * 3. Status updates: Each rider's entry changes to here, a time, or unknown.
 * 4. Missed stop prompt: If a rider passes without arriving, the app asks: Did you stop here?
 */

export interface StopPinningConfig {
  preAlertDistanceKm?: number; // Default: 2.0 km
  preAlertMinutes?: number;    // Default: 5 min
  arrivalRadiusKm?: number;     // Default: 0.2 km (200m)
  missedThresholdMeters?: number; // Default: 350 meters
}

const DEFAULT_PRE_ALERT_KM = 2.0;
const DEFAULT_PRE_ALERT_MINUTES = 5;
const DEFAULT_ARRIVAL_RADIUS_KM = 0.2; // 200m
const DEFAULT_MISSED_THRESHOLD_METERS = 350; // 350m past stop

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
