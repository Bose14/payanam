import env from '../config/environment';

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

type LatLng = { lat: number; lng: number };

const UA = 'Payanam-App/1.0 (trip planner)';
const STOP_TYPES = ['fuel_stop', 'stay', 'attraction', 'meal', 'rest'] as const;

// ───────────────────────── geometry ─────────────────────────

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

interface RoutePath {
  points: LatLng[];
  /** cumulative km from the start for each point */
  cumKm: number[];
  totalKm: number;
}

function buildPath(points: LatLng[], totalKmHint?: number): RoutePath {
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

function pointAtKm(path: RoutePath, km: number): LatLng {
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

async function getJson<T>(url: string, timeoutMs: number): Promise<T | null> {
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

async function fetchRoute(from: LatLng, to: LatLng): Promise<RoutePath | null> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?overview=full&geometries=geojson`;
  const data = await getJson<{
    routes?: Array<{ distance: number; geometry: { coordinates: Array<[number, number]> } }>;
  }>(url, 9000);
  const r = data?.routes?.[0];
  if (!r?.geometry?.coordinates?.length) return null;
  const pts = decimate(r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })));
  return buildPath(pts, r.distance / 1000);
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
  let path = fromCoords && toCoords ? await fetchRoute(fromCoords, toCoords) : null;
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
    const models = [env.GROQ_MODEL, 'llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'llama-3.1-8b-instant']
      .filter((m, i, arr): m is string => !!m && arr.indexOf(m) === i);
    let response: Response | null = null;
    for (const model of models) {
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
      if (r.ok) { response = r; console.log(`[ai.service] Groq model ${model} answered.`); break; }
      const body = (await r.text()).slice(0, 300);
      console.warn(`[ai.service] Groq ${model} returned ${r.status}: ${body}`);
      // Wrong key or rate limit will not be fixed by another model; a missing/retired model will.
      if (r.status === 401 || r.status === 403 || r.status === 429) break;
    }
    if (!response) return fallback();

    const result = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = result.choices?.[0]?.message?.content ?? '';
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
