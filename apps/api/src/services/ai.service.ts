import env from '../config/environment';
import {
  haversineKm, nearestOnPath, pointAtKm, buildPath, fetchBestRoute, getJson,
  type LatLng, type RoutePath,
} from './route.service';
import { poisAlongRoute, KIND_LABEL, type RoutePoi } from './routePlaces.service';

export { haversineKm, nearestOnPath };

/**
 * Itinerary generation.
 *
 * Rules this file keeps:
 *  1. Every place we return is a real place with real coordinates. Nothing is invented.
 *  2. The AI is only a suggestion engine. Its answer is checked against the real road route
 *     (OSRM) and against OpenStreetMap geocoding, and stops that cannot be verified are dropped.
 *  3. When the AI is unavailable we build the plan from the real route itself: the overnight
 *     towns are whatever towns the road actually passes through, found by reverse geocoding.
 */

export interface ItineraryStop {
  order: number;
  place: string;
  type: 'fuel_stop' | 'stay' | 'attraction' | 'meal' | 'rest';
  description: string;
  estimatedKm: number;
  durationHours: number;
  tips: string;
  lat?: number;
  lng?: number;
}

export interface ItineraryDay {
  day: number;
  stops: ItineraryStop[];
}

const STOP_TYPES = ['fuel_stop', 'stay', 'attraction', 'meal', 'rest'] as const;

// ───────────────────────── network helpers ─────────────────────────

// Nominatim allows about one request per second; serialise our calls.
let nominatimChain: Promise<unknown> = Promise.resolve();
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = nominatimChain.then(fn, fn);
  nominatimChain = run.then(
    () => new Promise((r) => setTimeout(r, 1100)),
    () => new Promise((r) => setTimeout(r, 1100)),
  );
  return run;
}

export async function geocodePlace(name: string): Promise<LatLng | null> {
  const q = encodeURIComponent(name);
  const india = await throttled(() =>
    getJson<Array<{ lat: string; lon: string }>>(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=in`, 4000),
  );
  if (india?.[0]) return { lat: parseFloat(india[0].lat), lng: parseFloat(india[0].lon) };
  // Nominatim sometimes refuses shared hosting IPs. Photon uses the same OpenStreetMap data.
  const photon = await getJson<{ features?: Array<{ geometry: { coordinates: [number, number] }; properties: { countrycode?: string } }> }>(
    `https://photon.komoot.io/api/?q=${q}&limit=3&lang=en`, 5000);
  const hit = photon?.features?.find((f) => !f.properties.countrycode || f.properties.countrycode === 'IN');
  return hit ? { lat: hit.geometry.coordinates[1], lng: hit.geometry.coordinates[0] } : null;
}

interface ReverseResult {
  address?: Record<string, string>;
}

/** A human place name ("Pollachi, Tamil Nadu") for the nearest town to a point. */
export async function townNameAt(p: LatLng): Promise<string | null> {
  const data = await throttled(() =>
    getJson<ReverseResult>(
      `https://nominatim.openstreetmap.org/reverse?lat=${p.lat}&lon=${p.lng}&format=json&zoom=10&addressdetails=1`, 4000),
  );
  const a = data?.address;
  if (!a) return null;
  const town = a.city || a.town || a.village || a.municipality || a.suburb || a.county || a.state_district;
  if (!town) return null;
  return a.state && a.state !== town ? `${town}, ${a.state}` : town;
}

// ───────────────────────── fallback built from the real road ─────────────────────────

/**
 * Used when the AI is not configured or fails. Every place is a real town on the real road:
 * the route is split into equal days, and the town nearest each split point is looked up.
 * No restaurant, viewpoint or fuel-station names are made up.
 */
async function buildRouteBasedItinerary(
  from: string,
  to: string,
  days: number,
  bikeType: string,
  tripType: string,
  path: RoutePath | null,
  fromCoords: LatLng | null,
  toCoords: LatLng | null,
): Promise<ItineraryDay[]> {
  const safeDays = Math.max(1, Math.min(days, 14));
  const roundTrip = tripType === 'round_trip' || tripType === 'loop';
  const outDays = roundTrip ? Math.max(1, Math.ceil(safeDays / 2)) : safeDays;
  const retDays = safeDays - outDays;
  const out: ItineraryDay[] = [];

  // Km position along the route where each day ends (outbound), then back again.
  const dayEndKm = (d: number): number => {
    if (!path) return 0;
    if (d <= outDays) return (path.totalKm * d) / outDays;
    const r = d - outDays;
    return path.totalKm * (1 - r / Math.max(retDays, 1));
  };
  const dayStartKm = (d: number): number => (d === 1 ? 0 : dayEndKm(d - 1));

  let lookups = 0;
  const nameFor = async (km: number, fallback: string): Promise<string> => {
    if (!path || lookups >= 24) return fallback;
    lookups += 1;
    return (await townNameAt(pointAtKm(path, km))) ?? fallback;
  };

  for (let d = 1; d <= safeDays; d++) {
    const stops: ItineraryStop[] = [];
    const startKm = dayStartKm(d);
    const endKm = dayEndKm(d);
    const dayKm = Math.abs(endKm - startKm);
    const isLast = d === safeDays;
    const returning = d > outDays;
    const midKm = (startKm + endKm) / 2;

    if (path && dayKm > 90) {
      const midPoint = pointAtKm(path, midKm);
      const midTown = await nameFor(midKm, '');
      if (midTown) {
        stops.push({
          order: stops.length + 1,
          place: midTown,
          type: 'meal',
          description: `Lunch and rest halfway through the day (about ${Math.round(dayKm / 2)} km from the morning start). Pick a dhaba with parking you can see from the road.`,
          estimatedKm: Math.round(dayKm / 2),
          durationHours: 1,
          tips: 'Refuel here if the tank is below half. Fuel stations can be 60 km apart on some stretches.',
          lat: midPoint.lat,
          lng: midPoint.lng,
        });
      }
    }

    let endPlace: string;
    let endPoint: LatLng | null;
    if (isLast) {
      endPlace = roundTrip && tripType === 'round_trip' ? from : to;
      endPoint = roundTrip && tripType === 'round_trip' ? fromCoords : toCoords;
    } else {
      endPoint = path ? pointAtKm(path, endKm) : null;
      endPlace = await nameFor(endKm, `Day ${d} overnight town`);
    }

    {
      stops.push({
        order: stops.length + 1,
        place: endPlace,
        type: 'stay',
        description: isLast
          ? `Journey ends here.`
          : `End of day ${d} (about ${Math.round(dayKm)} km${returning ? ' on the way back' : ''}). Look for a lodge with gated parking for the ${bikeType}.`,
        estimatedKm: Math.round(dayKm),
        durationHours: 0,
        tips: 'Check the chain and tyre pressure before turning in.',
        lat: endPoint?.lat,
        lng: endPoint?.lng,
      });
    }

    // Two stops with the same town name (short days) read as a mistake. Keep the overnight stay.
    const stay = stops.find((st) => st.type === 'stay');
    const deduped = stops.filter((st) => st.type === 'stay' || !stay || st.place !== stay.place);
    deduped.forEach((st, i) => { st.order = i + 1; });
    out.push({ day: d, stops: deduped });
  }
  return out;
}

/** One chat completion. Tries the next model when one is missing; null when nothing answered. */
async function groqText(prompt: string): Promise<string | null> {
  const models = [env.GROQ_MODEL, 'llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'llama-3.1-8b-instant']
    .filter((m, i, arr): m is string => !!m && arr.indexOf(m) === i);
  for (const model of models) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${env.GROQ_API_KEY.trim()}` },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 4096,
          response_format: { type: 'json_object' },
        }),
      });
      if (r.ok) {
        console.log(`[ai.service] Groq model ${model} answered.`);
        const result = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
        return result.choices?.[0]?.message?.content ?? '';
      }
      console.warn(`[ai.service] Groq ${model} returned ${r.status}: ${(await r.text()).slice(0, 300)}`);
      // Wrong key or rate limit will not be fixed by another model; a missing/retired model will.
      if (r.status === 401 || r.status === 403 || r.status === 429) return null;
    } catch (e) {
      console.warn(`[ai.service] Groq ${model} failed: ${(e as Error).message}`);
    }
  }
  return null;
}

// ───────────────────────── plan built from real places on the road ─────────────────────────

interface DayWindow { day: number; lo: number; hi: number; forward: boolean; startKm: number; endKm: number }

/** Where each day starts and ends along the road, outbound first, then back again. */
function dayWindows(path: RoutePath, days: number, tripType: string): DayWindow[] {
  const roundTrip = tripType === 'round_trip' || tripType === 'loop';
  const outDays = roundTrip ? Math.max(1, Math.ceil(days / 2)) : days;
  const retDays = days - outDays;
  const endKm = (d: number) => (d <= outDays ? (path.totalKm * d) / outDays : path.totalKm * (1 - (d - outDays) / Math.max(retDays, 1)));
  const out: DayWindow[] = [];
  for (let d = 1; d <= days; d++) {
    const startKm = d === 1 ? 0 : endKm(d - 1);
    const e = endKm(d);
    out.push({ day: d, lo: Math.min(startKm, e), hi: Math.max(startKm, e), forward: e >= startKm, startKm, endKm: e });
  }
  return out;
}

const describePoi = (p: RoutePoi): string => {
  const label = KIND_LABEL[p.kind];
  const where = p.offKm <= 0.5 ? 'right on your route' : `${p.offKm.toFixed(1)} km off the main road`;
  return `${label}, ${where}.`;
};

const TIPS: Partial<Record<RoutePoi['kind'], string>> = {
  waterfall: 'Check the water level and road condition before the last stretch. Wet rocks are slippery.',
  viewpoint: 'Good light is early morning and late afternoon.',
  fuel: 'Top up here if the tank is below half.',
  restaurant: 'Eat early on highway stretches. Parking is usually easy to spot from the road.',
  cafe: 'A good place for a tea break and a stretch.',
  hotel: 'Ask for gated or covered parking for the bike.',
};

/** Picks the places for one day from those that really lie on that day's part of the road. */
function selectForDay(
  pois: RoutePoi[],
  w: DayWindow,
  used: Set<string>,
  isLast: boolean,
  chooseIds?: string[],
): RoutePoi[] {
  const dayKm = w.hi - w.lo;
  const free = pois.filter((p) => p.km >= w.lo && p.km <= w.hi && !used.has(p.id));
  const picked: RoutePoi[] = [];
  const spaced = (p: RoutePoi, gap: number) => picked.every((q) => Math.abs(q.km - p.km) >= gap);

  if (chooseIds?.length) {
    for (const id of chooseIds) {
      const p = free.find((x) => x.id === id);
      if (p && spaced(p, 3) && !picked.includes(p)) picked.push(p);
    }
  }
  if (picked.length < 2) {
    const want = dayKm < 80 ? 2 : 3;
    const scenic = free.filter((p) => p.type === 'attraction').sort((a, b) => b.score - a.score);
    for (const p of scenic) {
      if (picked.filter((x) => x.type === 'attraction').length >= want) break;
      if (spaced(p, 12)) picked.push(p);
    }
  }
  const mid = (w.lo + w.hi) / 2;
  if (!picked.some((p) => p.type === 'meal' || p.type === 'rest') && dayKm > 60) {
    const meal = free
      .filter((p) => p.type === 'meal' || p.type === 'rest')
      .sort((a, b) => (b.score - Math.abs(b.km - mid) * 0.05) - (a.score - Math.abs(a.km - mid) * 0.05))[0];
    if (meal) picked.push(meal);
  }
  if (!picked.some((p) => p.type === 'fuel_stop') && dayKm >= 120) {
    const fuelAt = w.forward ? w.lo + dayKm * 0.55 : w.hi - dayKm * 0.55;
    const fuel = free.filter((p) => p.type === 'fuel_stop').sort((a, b) => Math.abs(a.km - fuelAt) - Math.abs(b.km - fuelAt))[0];
    if (fuel) picked.push(fuel);
  }
  if (!isLast) {
    const nearEnd = (p: RoutePoi) => (w.forward ? w.hi - p.km : p.km - w.lo);
    const stay = free.filter((p) => p.type === 'stay' && nearEnd(p) >= -5 && nearEnd(p) <= 40)
      .sort((a, b) => (b.score - nearEnd(b) * 0.1) - (a.score - nearEnd(a) * 0.1))[0];
    if (stay) picked.push(stay);
  }
  picked.forEach((p) => used.add(p.id));
  picked.sort((a, b) => (w.forward ? a.km - b.km : b.km - a.km));
  return picked;
}

async function buildPoiItinerary(
  from: string,
  to: string,
  days: number,
  bikeType: string,
  tripType: string,
  path: RoutePath,
  pois: RoutePoi[],
  fromCoords: LatLng | null,
  toCoords: LatLng | null,
  ai?: Map<number, string[]>,
): Promise<ItineraryDay[]> {
  const windows = dayWindows(path, days, tripType);
  const used = new Set<string>();
  const roundTrip = tripType === 'round_trip';
  const out: ItineraryDay[] = [];
  let lookups = 0;

  for (const w of windows) {
    const isLast = w.day === days;
    const picked = selectForDay(pois, w, used, isLast, ai?.get(w.day));
    const stops: ItineraryStop[] = [];
    let prevKm = w.startKm;
    for (const p of picked) {
      stops.push({
        order: stops.length + 1,
        place: p.name,
        type: p.type,
        description: describePoi(p),
        estimatedKm: Math.round(Math.abs(p.km - prevKm)),
        durationHours: p.type === 'attraction' ? 1 : p.type === 'fuel_stop' ? 0.25 : p.type === 'stay' ? 0 : 0.75,
        tips: TIPS[p.kind] ?? '',
        lat: p.lat,
        lng: p.lng,
      });
      prevKm = p.km;
    }

    if (isLast) {
      const endPlace = roundTrip ? from : to;
      const endPoint = roundTrip ? fromCoords : toCoords;
      stops.push({
        order: stops.length + 1, place: endPlace, type: 'stay', description: 'Journey ends here.',
        estimatedKm: Math.round(Math.abs(w.endKm - prevKm)), durationHours: 0,
        tips: 'Check the chain and tyre pressure before turning in.', lat: endPoint?.lat, lng: endPoint?.lng,
      });
    } else if (!stops.some((s) => s.type === 'stay')) {
      // No lodge mapped near the end of the day: name the town the road actually reaches.
      const at = pointAtKm(path, w.endKm);
      const town = lookups++ < 24 ? await townNameAt(at) : null;
      stops.push({
        order: stops.length + 1, place: town ?? `Day ${w.day} overnight town`, type: 'stay',
        description: `End of day ${w.day}. Look for a lodge with gated parking for the ${bikeType}.`,
        estimatedKm: Math.round(Math.abs(w.endKm - prevKm)), durationHours: 0,
        tips: 'Check the chain and tyre pressure before turning in.', lat: at.lat, lng: at.lng,
      });
    }
    stops.forEach((st, i) => { st.order = i + 1; });
    out.push({ day: w.day, stops });
  }
  return out;
}

/** The AI only chooses among real candidates, by id. It cannot add a place that is not on the road. */
async function aiChooseIds(
  from: string, to: string, days: number, bikeType: string, tripType: string, preferences: string,
  path: RoutePath, pois: RoutePoi[],
): Promise<Map<number, string[]> | null> {
  const windows = dayWindows(path, days, tripType);
  const lines = windows.map((w) => {
    const cand = pois
      .filter((p) => p.km >= w.lo && p.km <= w.hi && p.type !== 'stay')
      .sort((a, b) => b.score - a.score)
      .slice(0, 14)
      .sort((a, b) => (w.forward ? a.km - b.km : b.km - a.km));
    return `Day ${w.day} (${Math.round(w.hi - w.lo)} km of riding):\n` +
      (cand.map((p) => `  ${p.id} | ${KIND_LABEL[p.kind]} | ${p.name} | ${Math.round(Math.abs(p.km - w.startKm))} km from the day's start`).join('\n') || '  (no candidates)');
  }).join('\n');
  const prefs = preferences ? `\nRider preferences (follow them): ${preferences}` : '';
  const prompt = `You help plan a ${days}-day ${bikeType} motorcycle trip from ${from} to ${to} (${tripType.replace('_', ' ')}).
Below are REAL places that lie on the road, per day, as "id | kind | name | distance". Choose which to visit.${prefs}

${lines}

RULES: choose 3 to 4 ids per day, only from that day's list. Prefer waterfalls, viewpoints, forts and other sights a rider would not want to miss, plus one place to eat. Do not choose two places close to each other.
Return ONLY JSON: {"days":[{"day":1,"ids":["n123","w456"]}]}`;
  const text = await groqText(prompt);
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as { days?: Array<{ day?: unknown; ids?: unknown }> };
    const map = new Map<number, string[]>();
    for (const d of parsed.days ?? []) {
      const day = num(d.day);
      if (day !== null && Array.isArray(d.ids)) map.set(day, d.ids.filter((x): x is string => typeof x === 'string'));
    }
    return map.size ? map : null;
  } catch { return null; }
}

// ───────────────────────── AI path with verification ─────────────────────────

interface RawStop {
  place?: unknown; type?: unknown; description?: unknown; estimatedKm?: unknown;
  durationHours?: unknown; tips?: unknown; lat?: unknown; lng?: unknown;
}
interface RawDay { day?: unknown; stops?: unknown }

function str(v: unknown, max = 300): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}
function num(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

async function verifyAiItinerary(
  raw: RawDay[],
  days: number,
  path: RoutePath | null,
  tripType: string,
  straightLine = false,
): Promise<ItineraryDay[]> {
  const oneWay = tripType === 'one_way';
  // How far from the real road a stop may be. Detours for a waterfall or viewpoint are fine.
  const corridorKm = (oneWay ? 60 : 150) + (straightLine ? 60 : 0);
  const seen = new Set<string>();
  let geocodeBudget = 6;
  const result: ItineraryDay[] = [];

  for (const rd of raw.slice(0, days)) {
    const dayNo = num(rd.day) ?? result.length + 1;
    const stops: Array<ItineraryStop & { progress: number }> = [];
    const list = Array.isArray(rd.stops) ? (rd.stops as RawStop[]) : [];

    for (const s of list) {
      const place = str(s.place, 120);
      if (!place) continue;
      const key = place.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (!key || seen.has(key)) continue;

      let lat = num(s.lat);
      let lng = num(s.lng);
      let point: LatLng | null = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
      let onRoute = !!point && (!path || nearestOnPath(path, point).distKm <= corridorKm);

      if (!onRoute && geocodeBudget > 0) {
        geocodeBudget -= 1;
        const g = await geocodePlace(place);
        if (g && (!path || nearestOnPath(path, g).distKm <= corridorKm)) { point = g; onRoute = true; }
      }
      if (!point || !onRoute) continue; // cannot verify it, so it is not shown

      lat = point.lat;
      lng = point.lng;
      seen.add(key);
      const type = (STOP_TYPES as readonly string[]).includes(str(s.type)) ? (str(s.type) as ItineraryStop['type']) : 'attraction';
      stops.push({
        order: 0,
        place,
        type,
        description: str(s.description),
        estimatedKm: 0,
        durationHours: Math.max(0, Math.min(num(s.durationHours) ?? 1, 12)),
        tips: str(s.tips),
        lat,
        lng,
        progress: path ? nearestOnPath(path, point).index : stops.length,
      });
    }

    // Within a day, a one-way ride moves forward. Sort by position along the road.
    if (oneWay && path) stops.sort((a, b) => a.progress - b.progress);

    let prev: LatLng | null = null;
    stops.forEach((s, i) => {
      const here = { lat: s.lat as number, lng: s.lng as number };
      s.order = i + 1;
      // Real straight-line distance from the previous stop, with a road-winding allowance.
      s.estimatedKm = prev ? Math.round(haversineKm(prev, here) * 1.25) : 0;
      prev = here;
    });

    result.push({ day: dayNo, stops: stops.map(({ progress: _p, ...rest }) => rest) });
  }

  // A one-way plan must not go backwards between days.
  if (oneWay && path) {
    let highest = -1;
    for (const day of result) {
      day.stops = day.stops.filter((s) => {
        const idx = nearestOnPath(path, { lat: s.lat as number, lng: s.lng as number }).index;
        const backBy = highest - idx;
        if (backBy > path.points.length * 0.12) return false;
        highest = Math.max(highest, idx);
        return true;
      });
      day.stops.forEach((s, i) => { s.order = i + 1; });
    }
  }
  return result;
}

function isConfigured(): boolean {
  return !!env.GROQ_API_KEY && !env.GROQ_API_KEY.includes('REPLACE_') && env.GROQ_API_KEY.trim().length > 10;
}

export async function generateItinerary(
  from: string,
  to: string,
  days: number,
  bikeType: string,
  tripType: string,
  preferences: string,
  coords?: { fromLat?: number | null; fromLng?: number | null; toLat?: number | null; toLng?: number | null },
): Promise<ItineraryDay[]> {
  const safeDays = Math.max(1, Math.min(days, 14));

  const fromCoords: LatLng | null =
    coords?.fromLat != null && coords?.fromLng != null ? { lat: coords.fromLat, lng: coords.fromLng } : await geocodePlace(from);
  const toCoords: LatLng | null =
    coords?.toLat != null && coords?.toLng != null ? { lat: coords.toLat, lng: coords.toLng } : await geocodePlace(to);
  const best = fromCoords && toCoords ? await fetchBestRoute(fromCoords, toCoords) : null;
  let path: RoutePath | null = best?.path ?? null;
  if (best) console.log(`[ai.service] Route ${Math.round(best.distanceKm)} km, ${Math.round(best.durationMin)} min (best of ${best.alternatives}).`);
  let straightLine = false;
  if (!path && fromCoords && toCoords) {
    // Router unreachable: use the straight line (with a road-winding allowance) so towns can still be found.
    const pts = Array.from({ length: 60 }, (_, i) => ({
      lat: fromCoords.lat + ((toCoords.lat - fromCoords.lat) * i) / 59,
      lng: fromCoords.lng + ((toCoords.lng - fromCoords.lng) * i) / 59,
    }));
    path = buildPath(pts, haversineKm(fromCoords, toCoords) * 1.25);
    straightLine = true;
    console.warn('[ai.service] Route service unavailable. Using the straight line between start and end.');
  }

  // Real places that lie on the road. When there are enough, the plan is built from them only.
  const pois = path && !straightLine ? await poisAlongRoute(path) : [];
  console.log(`[ai.service] Places found on the route: ${pois.length}`);
  if (path && pois.length >= safeDays * 3) {
    const picks = isConfigured()
      ? await aiChooseIds(from, to, safeDays, bikeType, tripType, preferences, path, pois)
      : null;
    return buildPoiItinerary(from, to, safeDays, bikeType, tripType, path, pois, fromCoords, toCoords, picks ?? undefined);
  }

  const fallback = () => buildRouteBasedItinerary(from, to, safeDays, bikeType, tripType, path, fromCoords, toCoords);

  if (!isConfigured()) {
    console.warn('[ai.service] GROQ_API_KEY not configured. Building the plan from the real road route.');
    return fallback();
  }

  const tripInstruction: Record<string, string> = {
    one_way: `ONE-WAY from ${from} to ${to}. Every stop must be closer to ${to} than the one before it.`,
    round_trip: `ROUND TRIP: ride out from ${from} to ${to}, then return to ${from} by the last day.`,
    loop: `LOOP that starts and ends at ${from} and passes through ${to}, returning by a different road where one exists.`,
  };
  const routeFacts = path
    ? `The main road route from ${from} to ${to} is about ${Math.round(path.totalKm)} km. Aim for roughly ${Math.round(
        (path.totalKm * (tripType === 'one_way' ? 1 : 2)) / safeDays,
      )} km of riding per day.`
    : '';
  const startFacts = fromCoords && toCoords
    ? `Start coordinates: ${fromCoords.lat.toFixed(4)}, ${fromCoords.lng.toFixed(4)}. End coordinates: ${toCoords.lat.toFixed(4)}, ${toCoords.lng.toFixed(4)}.`
    : '';
  const prefs = preferences ? `\nRider preferences (follow them): ${preferences}` : '';

  const prompt = `You plan motorcycle trips in India. Suggest a ${safeDays}-day itinerary for a ${bikeType} trip.

${tripInstruction[tripType] ?? tripInstruction.one_way}
${routeFacts} ${startFacts}${prefs}

STRICT RULES:
- Only name places that really exist and that a rider can find on Google Maps. Use the form "Place, District, State".
- Do NOT invent names of restaurants, hotels, dhabas or fuel stations. Use well-known towns, named tourist spots (waterfalls, ghats, viewpoints, temples, forts) or a named, well-known restaurant only if you are certain it exists.
- Latitude and longitude must be the real coordinates of that exact place. If you are not sure, leave the place out.
- Stops must lie on or close to the road route. Never backtrack on a one-way trip.
- Each day: 3 to 5 stops, finishing at a town with places to stay, with the last stop of the day typed "stay".
- No place may appear twice in the whole plan.

Return ONLY a JSON object, no explanation, in this shape:
{"days":[{"day":1,"stops":[{"order":1,"place":"Place, District, State","type":"attraction","description":"One factual sentence","durationHours":1,"tips":"One useful tip for riders","lat":11.6643,"lng":78.1460}]}]}
type must be one of: fuel_stop, stay, attraction, meal, rest.`;

  try {
    const text = await groqText(prompt);
    if (text === null) return fallback();
    let rawDays: RawDay[] = [];
    try {
      const parsed = JSON.parse(text) as { days?: RawDay[] } | RawDay[];
      rawDays = Array.isArray(parsed) ? parsed : Array.isArray(parsed.days) ? parsed.days : [];
    } catch {
      const m = text.match(/\[[\s\S]*\]/);
      if (m) { try { rawDays = JSON.parse(m[0]) as RawDay[]; } catch { rawDays = []; } }
    }
    if (rawDays.length === 0) return fallback();

    const verified = await verifyAiItinerary(rawDays, safeDays, path, tripType, straightLine);
    const kept = verified.reduce((n, d) => n + d.stops.length, 0);
    const asked = rawDays.reduce((n, d) => n + (Array.isArray(d.stops) ? d.stops.length : 0), 0);
    console.log(`[ai.service] AI stops verified: ${kept}/${asked}`);

    // If too little survived checking, the AI answer is not trustworthy. Use the real route.
    if (kept < Math.max(2, Math.ceil(safeDays * 1.5)) || kept < asked * 0.4) return fallback();

    // Make sure every requested day exists, even if it lost all its stops.
    const have = new Set(verified.map((d) => d.day));
    for (let d = 1; d <= safeDays; d++) if (!have.has(d)) verified.push({ day: d, stops: [] });
    return verified.sort((a, b) => a.day - b.day);
  } catch (err) {
    console.error('[ai.service] Groq call failed:', err);
    return fallback();
  }
}
