import { haversineKm, nearestOnPath, UA, type LatLng, type RoutePath } from './route.service';

/**
 * Real places that lie ON the road route, read from OpenStreetMap (Overpass).
 *
 * Only places inside a narrow corridor around the route are returned, so a suggestion is never
 * on a separate track. Each place carries its position along the route (km from the start) and
 * how far it is from the road, so the itinerary and the "add a stop" list can order them.
 */

export type PoiKind =
  | 'waterfall' | 'viewpoint' | 'attraction' | 'fort' | 'temple' | 'peak' | 'beach' | 'lake'
  | 'restaurant' | 'cafe' | 'fuel' | 'hotel';

export type PoiStopType = 'fuel_stop' | 'stay' | 'attraction' | 'meal' | 'rest';

export interface RoutePoi {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: PoiKind;
  /** the stop type used by the itinerary */
  type: PoiStopType;
  /** km from the start of the route to the nearest point of the road */
  km: number;
  /** km from the road */
  offKm: number;
  score: number;
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const KIND_INFO: Record<PoiKind, { type: PoiStopType; base: number; maxOffKm: number }> = {
  waterfall: { type: 'attraction', base: 10, maxOffKm: 10 },
  viewpoint: { type: 'attraction', base: 9, maxOffKm: 8 },
  attraction: { type: 'attraction', base: 7, maxOffKm: 8 },
  fort: { type: 'attraction', base: 8, maxOffKm: 8 },
  temple: { type: 'attraction', base: 6, maxOffKm: 6 },
  peak: { type: 'attraction', base: 6, maxOffKm: 8 },
  beach: { type: 'attraction', base: 7, maxOffKm: 6 },
  lake: { type: 'attraction', base: 6, maxOffKm: 6 },
  restaurant: { type: 'meal', base: 4, maxOffKm: 2.5 },
  cafe: { type: 'rest', base: 4, maxOffKm: 2.5 },
  fuel: { type: 'fuel_stop', base: 3, maxOffKm: 2 },
  hotel: { type: 'stay', base: 4, maxOffKm: 3 },
};

export const KIND_LABEL: Record<PoiKind, string> = {
  waterfall: 'Waterfall', viewpoint: 'Viewpoint', attraction: 'Attraction', fort: 'Fort / heritage',
  temple: 'Temple', peak: 'Peak', beach: 'Beach', lake: 'Lake', restaurant: 'Restaurant',
  cafe: 'Cafe / tea', fuel: 'Fuel station', hotel: 'Stay',
};

function classify(t: Record<string, string>): PoiKind | null {
  if (t.natural === 'waterfall' || t.waterway === 'waterfall') return 'waterfall';
  if (t.tourism === 'viewpoint') return 'viewpoint';
  if (t.natural === 'peak') return 'peak';
  if (t.natural === 'beach') return 'beach';
  if (t.natural === 'water' && t.name && (t.water === 'lake' || t.water === 'reservoir')) return 'lake';
  if (t.historic && ['fort', 'castle', 'monument', 'ruins', 'palace'].includes(t.historic)) return 'fort';
  if (t.amenity === 'place_of_worship' && (t.wikidata || t.wikipedia)) return 'temple';
  if (t.tourism && ['attraction', 'museum', 'zoo', 'theme_park', 'artwork'].includes(t.tourism)) return 'attraction';
  if (t.amenity === 'restaurant') return 'restaurant';
  if (t.amenity === 'cafe') return 'cafe';
  if (t.amenity === 'fuel') return 'fuel';
  if (t.tourism && ['hotel', 'guest_house', 'resort', 'motel', 'hostel'].includes(t.tourism)) return 'hotel';
  return null;
}

function scoreOf(kind: PoiKind, tags: Record<string, string>, offKm: number): number {
  let s = KIND_INFO[kind].base;
  if (tags.wikidata) s += 3;
  if (tags.wikipedia) s += 2;
  if (tags.website || tags['contact:website']) s += 1;
  if (tags.opening_hours) s += 0.5;
  if (tags.cuisine || tags.brand || tags.stars) s += 0.5;
  if (tags.tourism === 'attraction' && tags.name) s += 0.5;
  return s - offKm * 0.4;
}

/** Corridor query for one stretch of the road. Scenic places may be a little off the road, services may not. */
function buildQuery(points: LatLng[]): string {
  const coords = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join(',');
  const scenic = `(around:9000,${coords})`;
  const service = `(around:2500,${coords})`;
  return `[out:json][timeout:25];
(
  nwr["natural"="waterfall"]["name"]${scenic};
  nwr["waterway"="waterfall"]["name"]${scenic};
  nwr["tourism"~"^(viewpoint|attraction|museum|zoo|theme_park)$"]["name"]${scenic};
  nwr["historic"~"^(fort|castle|monument|ruins|palace)$"]["name"]${scenic};
  nwr["natural"~"^(peak|beach)$"]["name"]${scenic};
  nwr["amenity"="place_of_worship"]["name"]["wikidata"]${scenic};
  nwr["amenity"~"^(restaurant|cafe|fuel)$"]["name"]${service};
  nwr["tourism"~"^(hotel|guest_house|resort)$"]["name"]${service};
);
out center tags 500;`;
}

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

async function runOverpass(query: string): Promise<OverpassElement[] | null> {
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(28000),
      });
      if (!res.ok) { console.warn(`[routePlaces] ${url} returned ${res.status}`); continue; }
      const json = (await res.json()) as { elements?: OverpassElement[] };
      return json.elements ?? [];
    } catch (e) {
      console.warn(`[routePlaces] ${url} failed: ${(e as Error).message}`);
    }
  }
  return null;
}

/** Splits the road into stretches of about `chunkKm` and samples a point every `stepKm`. */
function corridors(path: RoutePath, chunkKm = 120, stepKm = 8): LatLng[][] {
  const out: LatLng[][] = [];
  let current: LatLng[] = [];
  let lastKm = -Infinity;
  let chunkStart = 0;
  for (let i = 0; i < path.points.length; i++) {
    const km = path.cumKm[i];
    if (km - lastKm >= stepKm || i === path.points.length - 1) {
      current.push(path.points[i]);
      lastKm = km;
    }
    if (km - chunkStart >= chunkKm && current.length > 1) {
      out.push(current);
      // keep the last point so neighbouring stretches overlap and nothing falls in a gap
      current = [current[current.length - 1]];
      chunkStart = km;
    }
  }
  if (current.length > 1 || out.length === 0) out.push(current.length === 1 ? [current[0], current[0]] : current);
  return out;
}

const cache = new Map<string, { at: number; pois: RoutePoi[] }>();
const CACHE_MS = 30 * 60 * 1000;

function routeKey(path: RoutePath): string {
  const f = path.points[0];
  const m = path.points[Math.floor(path.points.length / 2)];
  const l = path.points[path.points.length - 1];
  return [f, m, l].map((p) => `${p.lat.toFixed(2)},${p.lng.toFixed(2)}`).join('|') + `|${Math.round(path.totalKm)}`;
}

/**
 * Named places along the route, in route order. Never throws: when Overpass is unreachable the
 * list is empty and callers fall back to what they did before.
 */
export async function poisAlongRoute(path: RoutePath, opts: { maxPerKind?: number } = {}): Promise<RoutePoi[]> {
  const key = routeKey(path);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.pois;

  const stretches = corridors(path).slice(0, 12);
  const results: Array<OverpassElement[] | null> = [];
  // Overpass is a shared service: a few at a time.
  for (let i = 0; i < stretches.length; i += 3) {
    results.push(...(await Promise.all(stretches.slice(i, i + 3).map((s) => runOverpass(buildQuery(s))))));
  }
  if (results.every((r) => r === null)) return [];

  const seen = new Set<string>();
  const pois: RoutePoi[] = [];
  for (const el of results.flat()) {
    if (!el?.tags) continue;
    const kind = classify(el.tags);
    if (!kind) continue;
    const name = (el.tags['name:en'] || el.tags.name || '').trim();
    if (name.length < 2) continue;
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;
    const dedupe = `${kind}:${name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`;
    if (seen.has(dedupe)) continue;

    const near = nearestOnPath(path, { lat, lng });
    const info = KIND_INFO[kind];
    if (near.distKm > info.maxOffKm) continue;
    seen.add(dedupe);
    pois.push({
      id: `${el.type[0]}${el.id}`,
      name,
      lat,
      lng,
      kind,
      type: info.type,
      km: Math.round(path.cumKm[near.index] * 10) / 10,
      offKm: Math.round(near.distKm * 10) / 10,
      score: scoreOf(kind, el.tags, near.distKm),
    });
  }

  // Cap noisy kinds so a long highway does not return a thousand fuel stations.
  const cap = opts.maxPerKind ?? 60;
  const byKind = new Map<PoiKind, RoutePoi[]>();
  for (const p of pois) (byKind.get(p.kind) ?? byKind.set(p.kind, []).get(p.kind)!).push(p);
  const kept = [...byKind.values()].flatMap((list) => list.sort((a, b) => b.score - a.score).slice(0, cap));
  kept.sort((a, b) => a.km - b.km);

  cache.set(key, { at: Date.now(), pois: kept });
  if (cache.size > 40) cache.delete(cache.keys().next().value as string);
  return kept;
}

export function distanceKm(a: LatLng, b: LatLng): number { return haversineKm(a, b); }
