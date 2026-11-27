import { UA } from './route.service';

/**
 * Place search as you type, like a map app: many results (towns, landmarks, waterfalls,
 * restaurants, fuel stations), biased toward where the rider is or where the route runs.
 * Photon (OpenStreetMap) is the main source because it is built for typing; Nominatim adds
 * anything it missed.
 */

export interface PlaceSuggestion {
  name: string;
  subtitle: string;
  lat: number;
  lng: number;
  kind?: string;
  country?: string;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string; street?: string; housenumber?: string; city?: string; district?: string; county?: string;
    state?: string; country?: string; countrycode?: string; osm_key?: string; osm_value?: string;
  };
}
interface NominatimHit { lat: string; lon: string; display_name: string; type?: string; class?: string }

const cache = new Map<string, { at: number; items: PlaceSuggestion[] }>();

async function getJson<T>(url: string, ms: number): Promise<T | null> {
  try {
    const r = await fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': UA }, signal: AbortSignal.timeout(ms) });
    return r.ok ? ((await r.json()) as T) : null;
  } catch { return null; }
}

const humanize = (v: string) => v.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

function fromPhoton(f: PhotonFeature): PlaceSuggestion | null {
  const p = f.properties;
  const name = (p.name || [p.housenumber, p.street].filter(Boolean).join(' ')).trim();
  if (!name || !f.geometry?.coordinates) return null;
  const area = [p.district || p.city, p.county, p.state].filter((x, i, a): x is string => !!x && x !== name && a.indexOf(x) === i);
  const subtitle = [...area.slice(0, 2), p.countrycode && p.countrycode !== 'IN' ? p.country : ''].filter(Boolean).join(', ');
  const kind = p.osm_value && p.osm_value !== 'yes' ? humanize(p.osm_value) : undefined;
  return { name, subtitle, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], kind, country: p.countrycode };
}

function fromNominatim(h: NominatimHit): PlaceSuggestion {
  const parts = h.display_name.split(',').map((s) => s.trim());
  return {
    name: parts[0], subtitle: parts.slice(1, 3).join(', '), lat: parseFloat(h.lat), lng: parseFloat(h.lon),
    kind: h.type && h.type !== 'yes' ? humanize(h.type) : undefined,
  };
}

export async function suggestPlaces(query: string, bias?: { lat: number; lng: number }): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  const key = `${q.toLowerCase()}|${bias ? `${bias.lat.toFixed(1)},${bias.lng.toFixed(1)}` : ''}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.items;

  const enc = encodeURIComponent(q);
  const biasQs = bias ? `&lat=${bias.lat}&lon=${bias.lng}&location_bias_scale=0.35` : '';
  const [photon, nominatim] = await Promise.all([
    getJson<{ features?: PhotonFeature[] }>(`https://photon.komoot.io/api/?q=${enc}&limit=12&lang=en${biasQs}`, 5000),
    getJson<NominatimHit[]>(`https://nominatim.openstreetmap.org/search?q=${enc}&format=json&limit=6&countrycodes=in`, 5000),
  ]);

  const all: PlaceSuggestion[] = [
    ...(photon?.features ?? []).map(fromPhoton).filter((x): x is PlaceSuggestion => !!x),
    ...(Array.isArray(nominatim) ? nominatim.map(fromNominatim) : []),
  ].filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));

  const seen = new Set<string>();
  const unique = all.filter((s) => {
    const k = `${s.name.toLowerCase()}|${s.lat.toFixed(2)}|${s.lng.toFixed(2)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  // Riders are mostly in India: Indian results first, the rest after, order otherwise kept.
  const items = [...unique.filter((s) => !s.country || s.country === 'IN'), ...unique.filter((s) => s.country && s.country !== 'IN')].slice(0, 10);

  if (items.length) {
    cache.set(key, { at: Date.now(), items });
    if (cache.size > 300) cache.delete(cache.keys().next().value as string);
  }
  return items;
}
