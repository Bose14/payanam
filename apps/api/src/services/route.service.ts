/**
 * Road routing and geometry shared by itinerary generation and place suggestions.
 *
 * The route is the best of the alternatives OSRM offers: the one that is quickest, with a small
 * preference for the shorter one, the way a map app picks its first suggestion.
 */

export type LatLng = { lat: number; lng: number };

export const UA = 'Payanam-App/1.0 (trip planner)';

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export interface RoutePath {
  points: LatLng[];
  /** cumulative km from the start for each point */
  cumKm: number[];
  totalKm: number;
}

export function buildPath(points: LatLng[], totalKmHint?: number): RoutePath {
  const cumKm: number[] = [0];
  for (let i = 1; i < points.length; i++) cumKm.push(cumKm[i - 1] + haversineKm(points[i - 1], points[i]));
  const measured = cumKm[cumKm.length - 1] ?? 0;
  // Prefer the router's own driving distance, scaling the cumulative values to match it.
  const totalKm = totalKmHint && totalKmHint > 0 ? totalKmHint : measured;
  const scale = measured > 0 ? totalKm / measured : 1;
  return { points, cumKm: cumKm.map((k) => k * scale), totalKm };
}

/** Index of the path point closest to `p`, with its distance in km. */
export function nearestOnPath(path: RoutePath, p: LatLng): { index: number; distKm: number } {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < path.points.length; i++) {
    const d = haversineKm(path.points[i], p);
    if (d < bestD) { bestD = d; best = i; }
  }
  return { index: best, distKm: bestD };
}

export function pointAtKm(path: RoutePath, km: number): LatLng {
  const target = Math.max(0, Math.min(km, path.totalKm));
  let lo = 0;
  let hi = path.cumKm.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (path.cumKm[mid] < target) lo = mid + 1; else hi = mid;
  }
  return path.points[lo];
}

function decimate(points: LatLng[], maxPoints = 1500): LatLng[] {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  const out = points.filter((_, i) => i % step === 0);
  const last = points[points.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

// ───────────────────────── network helpers ─────────────────────────

export async function getJson<T>(url: string, timeoutMs: number): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en', 'User-Agent': UA },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}



export interface BestRoute { path: RoutePath; distanceKm: number; durationMin: number; alternatives: number }

interface OsrmRoute { distance: number; duration?: number; geometry: { coordinates: Array<[number, number]> } }

/** Lower is better: minutes of driving, plus a small penalty per km so a much longer road loses. */
function routeScore(r: { distance: number; duration?: number }): number {
  const km = r.distance / 1000;
  const minutes = typeof r.duration === 'number' ? r.duration / 60 : km * 1.4;
  return minutes + km * 0.25;
}

export async function fetchBestRoute(from: LatLng, to: LatLng): Promise<BestRoute | null> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?overview=full&geometries=geojson&alternatives=true`;
  const data = await getJson<{ routes?: OsrmRoute[] }>(url, 12000);
  const routes = (data?.routes ?? []).filter((r) => r?.geometry?.coordinates?.length);
  if (routes.length === 0) return null;
  const best = routes.reduce((a, b) => (routeScore(b) < routeScore(a) ? b : a));
  const pts = decimate(best.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })));
  const distanceKm = best.distance / 1000;
  return {
    path: buildPath(pts, distanceKm),
    distanceKm,
    durationMin: typeof best.duration === 'number' ? best.duration / 60 : distanceKm * 1.4,
    alternatives: routes.length,
  };
}
