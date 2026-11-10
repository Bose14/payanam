/**
 * Route-deviation alert Engine (Feature C · Tracking)
 * 
 * Rules:
 * 1. Compare to the route: Each new position is measured against the planned route line.
 * 2. Threshold is crossed: Off route by more than 300 m for 2 minutes. The threshold is strict to avoid false alarms.
 * 3. Group is alerted: The alert goes to the group, not to the individual rider only.
 * 4. Captain acts: The captain can tap Regroup, which sends an announcement to everyone.
 * 5. Alert clears: When the rider is back on the line, the card and alert clear.
 */

export interface DeviationConfig {
  thresholdMeters?: number; // Default: 300 meters
  durationMs?: number;      // Default: 120,000 ms (2 minutes)
}

export const DEFAULT_DEVIATION_THRESHOLD_METERS = 300;
export const DEFAULT_DEVIATION_DURATION_MS = 2 * 60 * 1000; // 2 minutes

export interface RiderDeviationTracker {
  userId: string;
  userName: string;
  lat: number;
  lng: number;
  distanceMeters: number;
  firstOffRouteAt: number | null; // epoch timestamp ms
  durationSeconds: number;
  isDeviated: boolean;
  lastEvaluatedAt: number;
}

export interface OffRouteAlert {
  userId: string;
  userName: string;
  lat: number;
  lng: number;
  distanceMeters: number;
  durationSeconds: number;
  firstOffRouteAt: number;
  nearestRoutePoint: [number, number];
}

const EARTH_RADIUS_METERS = 6371000;

/**
 * Standard Haversine distance between two coordinates in meters.
 */
export function getHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculates perpendicular distance in meters from point P to line segment AB,
 * properly clamping to segment endpoints.
 */
export function pointToSegmentDistanceMeters(
  pLat: number,
  pLng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): { distanceMeters: number; closestPoint: [number, number] } {
  // Use equirectangular planar projection for segment projection accuracy
  const midLatRad = (((aLat + bLat) / 2) * Math.PI) / 180;
  const cosMid = Math.cos(midLatRad);

  const ax = (aLng * Math.PI * EARTH_RADIUS_METERS * cosMid) / 180;
  const ay = (aLat * Math.PI * EARTH_RADIUS_METERS) / 180;

  const bx = (bLng * Math.PI * EARTH_RADIUS_METERS * cosMid) / 180;
  const by = (bLat * Math.PI * EARTH_RADIUS_METERS) / 180;

  const px = (pLng * Math.PI * EARTH_RADIUS_METERS * cosMid) / 180;
  const py = (pLat * Math.PI * EARTH_RADIUS_METERS) / 180;

  const dx = bx - ax;
  const dy = by - ay;
  const segLengthSq = dx * dx + dy * dy;

  if (segLengthSq === 0) {
    const dist = getHaversineDistanceMeters(pLat, pLng, aLat, aLng);
    return { distanceMeters: dist, closestPoint: [aLat, aLng] };
  }

  // Projection parameter t clamped to [0, 1]
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / segLengthSq));

  const closestLat = aLat + t * (bLat - aLat);
  const closestLng = aLng + t * (bLng - aLng);
  const dist = getHaversineDistanceMeters(pLat, pLng, closestLat, closestLng);

  return {
    distanceMeters: dist,
    closestPoint: [closestLat, closestLng],
  };
}

/**
 * Calculates the minimum distance in meters from a rider coordinate to an entire route polyline.
 */
export function getMinDistanceToRoute(
  lat: number,
  lng: number,
  route: Array<[number, number]>
): { minDistanceMeters: number; nearestPoint: [number, number] } {
  if (!route || route.length === 0) {
    return { minDistanceMeters: 0, nearestPoint: [lat, lng] };
  }
  if (route.length === 1) {
    const d = getHaversineDistanceMeters(lat, lng, route[0][0], route[0][1]);
    return { minDistanceMeters: d, nearestPoint: route[0] };
  }

  let minDistance = Infinity;
  let nearest: [number, number] = route[0];

  for (let i = 0; i < route.length - 1; i++) {
    const segA = route[i];
    const segB = route[i + 1];
    const { distanceMeters, closestPoint } = pointToSegmentDistanceMeters(
      lat,
      lng,
      segA[0],
      segA[1],
      segB[0],
      segB[1]
    );

    if (distanceMeters < minDistance) {
      minDistance = distanceMeters;
      nearest = closestPoint;
    }
  }

  return { minDistanceMeters: minDistance, nearestPoint: nearest };
}

/**
 * Evaluates a single rider against the active route using the 300m / 2min criteria.
 */
export function evaluateRiderDeviation(
  rider: { userId: string; userName: string; lat: number; lng: number },
  route: Array<[number, number]>,
  prevTracker?: RiderDeviationTracker | null,
  config?: DeviationConfig
): RiderDeviationTracker {
  const thresholdMeters = config?.thresholdMeters ?? DEFAULT_DEVIATION_THRESHOLD_METERS;
  const durationMs = config?.durationMs ?? DEFAULT_DEVIATION_DURATION_MS;
  const now = Date.now();

  if (!route || route.length < 2) {
    return {
      userId: rider.userId,
      userName: rider.userName,
      lat: rider.lat,
      lng: rider.lng,
      distanceMeters: 0,
      firstOffRouteAt: null,
      durationSeconds: 0,
      isDeviated: false,
      lastEvaluatedAt: now,
    };
  }

  const { minDistanceMeters } = getMinDistanceToRoute(rider.lat, rider.lng, route);

  let firstOffRouteAt = prevTracker?.firstOffRouteAt ?? null;
  let isDeviated = false;
  let durationSeconds = 0;

  if (minDistanceMeters > thresholdMeters) {
    if (firstOffRouteAt == null) {
      firstOffRouteAt = now;
    }
    const elapsedMs = now - firstOffRouteAt;
    durationSeconds = Math.floor(elapsedMs / 1000);
    // Threshold is crossed: off route by > 300m for >= 2 minutes
    if (elapsedMs >= durationMs) {
      isDeviated = true;
    }
  } else {
    // Alert clears: When the rider is back on the line (<= 300m), clear deviation timer
    firstOffRouteAt = null;
    isDeviated = false;
    durationSeconds = 0;
  }

  return {
    userId: rider.userId,
    userName: rider.userName,
    lat: rider.lat,
    lng: rider.lng,
    distanceMeters: minDistanceMeters,
    firstOffRouteAt,
    durationSeconds,
    isDeviated,
    lastEvaluatedAt: now,
  };
}

/**
 * Formats off-route duration for human-readable badges (e.g. "2 min", "5 min").
 */
export function formatOffRouteDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, seconds)}s`;
  const mins = Math.floor(seconds / 60);
  return `${mins} min`;
}

/**
 * Formats distance off route (e.g. "450 m", "1.2 km").
 */
export function formatOffRouteDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
