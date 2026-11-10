/**
 * Planned Route Progress Engine (Feature E2 · Tracking)
 * 
 * Rules:
 * 1. Route loaded: The route comes from the trip plan (Plan tab).
 * 2. Line drawn: The planned line appears on the Ride map with the stops marked.
 * 3. Riders placed: Each rider's latest position is placed on the line by progress along the route.
 * 4. Status shown: Ahead, on plan, behind, or off route appear through shape and colour, with a text label.
 */

import { getHaversineDistanceMeters, pointToSegmentDistanceMeters } from './routeDeviation';

export type RouteProgressStatus = 'ahead' | 'on_plan' | 'behind' | 'off_route' | 'unknown';

export interface RouteProgressInfo {
  distanceAlongMeters: number;
  totalRouteMeters: number;
  progressPercent: number; // 0 - 100
  crossTrackDistanceMeters: number;
  nearestPointOnRoute: [number, number];
}

export interface RiderRouteStatus {
  status: RouteProgressStatus;
  label: string;
  deltaMeters: number; // relative to reference rider (lead/captain or user)
  deltaFormatted: string;
  badgeTextColor: string;
  badgeBorderColor: string;
  badgeBgColor: string;
  shape: 'chevron' | 'circle' | 'square' | 'octagon' | 'dimmed';
  progressPercent: number;
  distanceAlongMeters: number;
}

/**
 * Calculates total distance of a route polyline in meters.
 */
export function getRouteTotalDistance(route: Array<[number, number]>): number {
  if (!route || route.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    total += getHaversineDistanceMeters(
      route[i][0],
      route[i][1],
      route[i + 1][0],
      route[i + 1][1]
    );
  }
  return total;
}

/**
 * Calculates a point's progress along a planned route polyline.
 * Projects the coordinate onto each segment and finds cumulative distance from start.
 */
export function calculateRouteProgress(
  point: [number, number],
  route: Array<[number, number]>,
  totalRouteMetersCached?: number
): RouteProgressInfo {
  const [pLat, pLng] = point;
  const totalMeters = totalRouteMetersCached ?? getRouteTotalDistance(route);

  if (!route || route.length === 0) {
    return {
      distanceAlongMeters: 0,
      totalRouteMeters: 0,
      progressPercent: 0,
      crossTrackDistanceMeters: 0,
      nearestPointOnRoute: [pLat, pLng],
    };
  }

  if (route.length === 1) {
    const dist = getHaversineDistanceMeters(pLat, pLng, route[0][0], route[0][1]);
    return {
      distanceAlongMeters: 0,
      totalRouteMeters: 0,
      progressPercent: 0,
      crossTrackDistanceMeters: dist,
      nearestPointOnRoute: route[0],
    };
  }

  let minDistance = Infinity;
  let nearestPoint: [number, number] = route[0];
  let bestProgressAlong = 0;
  let cumulativeDistanceBeforeBestSegment = 0;
  let runningCumulative = 0;

  for (let i = 0; i < route.length - 1; i++) {
    const segA = route[i];
    const segB = route[i + 1];
    const segLength = getHaversineDistanceMeters(segA[0], segA[1], segB[0], segB[1]);

    const { distanceMeters, closestPoint } = pointToSegmentDistanceMeters(
      pLat,
      pLng,
      segA[0],
      segA[1],
      segB[0],
      segB[1]
    );

    if (distanceMeters < minDistance) {
      minDistance = distanceMeters;
      nearestPoint = closestPoint;
      cumulativeDistanceBeforeBestSegment = runningCumulative;

      // Distance from segA to closestPoint
      const distFromSegA = getHaversineDistanceMeters(
        segA[0],
        segA[1],
        closestPoint[0],
        closestPoint[1]
      );
      bestProgressAlong = cumulativeDistanceBeforeBestSegment + distFromSegA;
    }

    runningCumulative += segLength;
  }

  const clampedProgress = Math.max(0, Math.min(totalMeters, bestProgressAlong));
  const progressPercent = totalMeters > 0 ? (clampedProgress / totalMeters) * 100 : 0;

  return {
    distanceAlongMeters: clampedProgress,
    totalRouteMeters: totalMeters,
    progressPercent: Math.min(100, Math.max(0, progressPercent)),
    crossTrackDistanceMeters: minDistance,
    nearestPointOnRoute: nearestPoint,
  };
}

/**
 * Determines a rider's on-route status ("Ahead", "On plan", "Behind", "Off route")
 * based on Feature E2 specifications.
 */
export function evaluateRiderRouteStatus(params: {
  riderProgressMeters: number;
  refProgressMeters: number;
  crossTrackMeters: number;
  isOffRouteAlert: boolean;
  isStaleOrUnknown: boolean;
  aheadThresholdMeters?: number;  // Default: 400m
  behindThresholdMeters?: number; // Default: 400m
  progressPercent?: number;
}): RiderRouteStatus {
  const {
    riderProgressMeters,
    refProgressMeters,
    isOffRouteAlert,
    isStaleOrUnknown,
    aheadThresholdMeters = 400,
    behindThresholdMeters = 400,
    progressPercent = 0,
  } = params;

  // 1. Off Route has highest priority (exceeded 300m for 2min)
  if (isOffRouteAlert) {
    return {
      status: 'off_route',
      label: 'OFF ROUTE',
      deltaMeters: 0,
      deltaFormatted: 'Off route',
      badgeTextColor: '#EF4444',
      badgeBorderColor: '#EF4444',
      badgeBgColor: 'rgba(239, 68, 68, 0.15)',
      shape: 'octagon',
      progressPercent,
      distanceAlongMeters: riderProgressMeters,
    };
  }

  // 2. Unknown / Stale (> 5 min)
  if (isStaleOrUnknown) {
    return {
      status: 'unknown',
      label: 'UNKNOWN',
      deltaMeters: 0,
      deltaFormatted: 'No recent fix',
      badgeTextColor: '#9D9C9A',
      badgeBorderColor: '#3A3F47',
      badgeBgColor: 'rgba(157, 156, 154, 0.12)',
      shape: 'dimmed',
      progressPercent,
      distanceAlongMeters: riderProgressMeters,
    };
  }

  // 3. Comparison with reference rider (Lead / Captain or user position)
  const delta = riderProgressMeters - refProgressMeters;

  if (delta > aheadThresholdMeters) {
    const formattedDelta = delta >= 1000
      ? `+${(delta / 1000).toFixed(1)} km`
      : `+${Math.round(delta)} m`;
    return {
      status: 'ahead',
      label: 'AHEAD',
      deltaMeters: delta,
      deltaFormatted: `${formattedDelta} ahead`,
      badgeTextColor: '#38BDF8',
      badgeBorderColor: '#38BDF8',
      badgeBgColor: 'rgba(56, 189, 248, 0.14)',
      shape: 'chevron',
      progressPercent,
      distanceAlongMeters: riderProgressMeters,
    };
  }

  if (delta < -behindThresholdMeters) {
    const absDelta = Math.abs(delta);
    const formattedDelta = absDelta >= 1000
      ? `-${(absDelta / 1000).toFixed(1)} km`
      : `-${Math.round(absDelta)} m`;
    return {
      status: 'behind',
      label: 'BEHIND',
      deltaMeters: delta,
      deltaFormatted: `${formattedDelta} behind`,
      badgeTextColor: '#F59E0B',
      badgeBorderColor: '#F59E0B',
      badgeBgColor: 'rgba(245, 158, 11, 0.14)',
      shape: 'square',
      progressPercent,
      distanceAlongMeters: riderProgressMeters,
    };
  }

  return {
    status: 'on_plan',
    label: 'ON PLAN',
    deltaMeters: delta,
    deltaFormatted: 'On plan',
    badgeTextColor: '#10B981',
    badgeBorderColor: '#10B981',
    badgeBgColor: 'rgba(16, 185, 129, 0.14)',
    shape: 'circle',
    progressPercent,
    distanceAlongMeters: riderProgressMeters,
  };
}
