/* Run: npx tsx scripts/test-route-places.ts   (mocks every network call) */
import assert from 'node:assert';

Object.assign(process.env, {
  SUPABASE_URL: 'http://localhost', SUPABASE_ANON_KEY: 'x', SUPABASE_SERVICE_ROLE_KEY: 'x',
  DATABASE_URL: 'x', JWT_SECRET: 'x'.repeat(40), GROQ_API_KEY: '',
});

const A = { lat: 11.6643, lng: 78.146 }, B = { lat: 10.0889, lng: 77.0595 };
const at = (f: number, off = 0) => ({ lat: A.lat + (B.lat - A.lat) * f + off, lng: A.lng + (B.lng - A.lng) * f });
const line = (bend = 0) => Array.from({ length: 200 }, (_, i) => {
  const f = i / 199; const p = at(f); return [p.lng + Math.sin(f * Math.PI) * bend, p.lat];
});
const el = (id: number, f: number, off: number, tags: Record<string, string>) => ({ type: 'node', id, lat: at(f, off).lat, lon: at(f, off).lng, tags });
const elements = [
  el(1, 0.15, 0.02, { name: 'Hogenakkal Falls', natural: 'waterfall', wikidata: 'Q1' }),
  el(2, 0.30, 0.02, { name: 'Sunset Point', tourism: 'viewpoint' }),
  el(3, 0.45, 0.01, { name: 'Highway Dhaba', amenity: 'restaurant' }),
  el(4, 0.50, 0.01, { name: 'Erode Fuel', amenity: 'fuel' }),
  el(5, 0.52, 0.01, { name: 'Hotel Erode Inn', tourism: 'hotel' }),
  el(6, 0.70, 0.02, { name: 'Fort Hill', historic: 'fort' }),
  el(7, 0.85, 0.02, { name: 'Marayoor Falls', natural: 'waterfall' }),
  el(8, 0.40, 0.45, { name: 'Far Away Falls', natural: 'waterfall' }),      // ~50 km off the road
  el(9, 0.60, 0.05, { name: 'Roadside Restaurant', amenity: 'restaurant' }),
  el(10, 0.55, 0, { amenity: 'restaurant' }),                              // no name
  el(11, 0.95, 0.01, { name: 'Munnar View Hotel', tourism: 'hotel' }),
];
let aiIds: unknown = null;
let osrm: unknown[] = [];
let overpassDown = false;
const calls: string[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
  calls.push(url);
  if (url.includes('router.project-osrm.org')) return json({ routes: osrm });
  if (url.includes('overpass')) return overpassDown ? json({}, 504) : json({ elements });
  if (url.includes('/reverse')) return json({ address: { town: 'Pollachi', state: 'Tamil Nadu' } });
  if (url.includes('nominatim') && url.includes('/search')) {
    const q = decodeURIComponent(new URL(url).searchParams.get('q') || '').toLowerCase();
    if (q.includes('salem')) return json([{ lat: String(A.lat), lon: String(A.lng), display_name: 'Salem, Tamil Nadu, India', type: 'city' }]);
    if (q.includes('munnar')) return json([{ lat: String(B.lat), lon: String(B.lng), display_name: 'Munnar, Kerala, India', type: 'town' }]);
    if (q.includes('falls')) return json([{ lat: '12.1', lon: '77.8', display_name: 'Hogenakkal Falls, Dharmapuri, Tamil Nadu, India', type: 'waterfall' }]);
    return json([]);
  }
  if (url.includes('photon.komoot.io')) {
    const q = decodeURIComponent(new URL(url).searchParams.get('q') || '').toLowerCase();
    if (q.includes('falls')) return json({ features: [
      { geometry: { coordinates: [77.8, 12.1] }, properties: { name: 'Hogenakkal Falls', district: 'Dharmapuri', state: 'Tamil Nadu', countrycode: 'IN', osm_key: 'natural', osm_value: 'waterfall' } },
      { geometry: { coordinates: [77.2, 10.3] }, properties: { name: 'Athirappilly Falls', state: 'Kerala', countrycode: 'IN', osm_key: 'natural', osm_value: 'waterfall' } },
      { geometry: { coordinates: [85.3, 27.7] }, properties: { name: 'Falls Cafe', state: 'Bagmati', country: 'Nepal', countrycode: 'NP', osm_key: 'amenity', osm_value: 'cafe' } },
      { geometry: { coordinates: [77.8, 12.1] }, properties: { name: 'Hogenakkal Falls', state: 'Tamil Nadu', countrycode: 'IN', osm_key: 'natural', osm_value: 'waterfall' } },
    ] });
    return json({ features: [] });
  }
  if (url.includes('groq.com')) return json({ choices: [{ message: { content: JSON.stringify(aiIds) } }] });
  return realFetch(input as RequestInfo, init);
}) as typeof fetch;
const realSetTimeout = globalThis.setTimeout;
(globalThis as any).setTimeout = ((fn: () => void, ms?: number, ...a: unknown[]) => realSetTimeout(fn, ms && ms > 1000 && ms < 1200 ? 0 : ms, ...a)) as typeof setTimeout;

(async () => {
  const { fetchBestRoute } = await import('../src/services/route.service');
  const { poisAlongRoute } = await import('../src/services/routePlaces.service');
  const { generateItinerary } = await import('../src/services/ai.service');
  const { suggestPlaces } = await import('../src/services/placeSearch.service');
  const env = (await import('../src/config/environment')).default as { GROQ_API_KEY: string };

  // 1. Route choice: of three alternatives pick the quickest, not the first listed.
  osrm = [
    { distance: 300000, duration: 22000, geometry: { coordinates: line(0.3) } },  // longer and slower
    { distance: 275000, duration: 17000, geometry: { coordinates: line(0) } },    // best
    { distance: 280000, duration: 18500, geometry: { coordinates: line(-0.3) } },
  ];
  const best = await fetchBestRoute(A, B);
  assert(best && Math.round(best.distanceKm) === 275 && best.alternatives === 3, 'best of three alternatives: ' + best?.distanceKm);
  console.log('route:', Math.round(best!.distanceKm), 'km, best of', best!.alternatives);

  // 2. Places: only those near the road, in route order, nameless and far ones dropped.
  const pois = await poisAlongRoute(best!.path);
  const names = pois.map((p) => p.name);
  console.log('on route:', names.join(' | '));
  assert(!names.includes('Far Away Falls'), 'far place dropped');
  assert(names.includes('Hogenakkal Falls') && names.includes('Fort Hill'), 'near places kept');
  assert(!names.includes('Roadside Restaurant'), 'restaurant 5 km off is not on the route');
  assert(pois.every((p, i) => i === 0 || pois[i - 1].km <= p.km), 'sorted by position along the road');
  assert(pois.length === 8, 'count ' + pois.length);

  // 3. Itinerary with no AI: stops come only from those places, in order, and a stay ends each day.
  const plan = await generateItinerary('Salem', 'Munnar', 2, 'Bike', 'one_way', '');
  const all = plan.flatMap((d) => d.stops);
  console.log(plan.map((d) => d.stops.map((s) => `${s.place}[${s.type}]`).join(' > ')).join('\n'));
  const onRoute = new Set(pois.map((p) => p.name));
  assert(all.filter((s) => s.type !== 'stay' || onRoute.has(s.place)).every((s) => onRoute.has(s.place) || /Munnar/.test(s.place)), 'only real on-route places');
  assert(plan.every((d) => d.stops.length >= 2), 'every day has stops');
  assert(plan[0].stops.some((s) => s.type === 'attraction'), 'day 1 has a sight');
  assert(/Munnar/.test(plan[1].stops[plan[1].stops.length - 1].place), 'ends at the destination');
  const km = plan[0].stops.map((s) => pois.find((p) => p.name === s.place)?.km).filter((k): k is number => k !== undefined);
  assert(km.every((k, i) => i === 0 || km[i - 1] <= k), 'forward order on day 1');

  // 4. With AI: it picks by id. An id that is not a candidate is ignored.
  env.GROQ_API_KEY = 'k'.repeat(20);
  aiIds = { days: [{ day: 1, ids: ['n2', 'n1', 'n999'] }, { day: 2, ids: ['n7', 'n6'] }] };
  const ai = await generateItinerary('Salem', 'Munnar', 2, 'Bike', 'one_way', 'waterfalls');
  const aiNames = ai.flatMap((d) => d.stops.map((s) => s.place));
  console.log('AI picks:', aiNames.join(' | '));
  assert(aiNames.includes('Sunset Point') && aiNames.includes('Hogenakkal Falls') && aiNames.includes('Marayoor Falls'), 'AI choices used');
  assert(!aiNames.some((n) => /999/.test(n)), 'invented id ignored');

  // 5. Overpass down: plan still produced from the road (no crash, no empty days).
  overpassDown = true;
  (globalThis as any).__x = 1;
  const { poisAlongRoute: p2 } = await import('../src/services/routePlaces.service');
  osrm = [{ distance: 276000, duration: 17100, geometry: { coordinates: line(0.01) } }]; // different key, no cache
  const fb = await generateItinerary('Salem', 'Munnar', 2, 'Bike', 'one_way', '');
  assert(fb.every((d) => d.stops.length > 0), 'fallback not empty');
  assert((await p2((await fetchBestRoute(A, B))!.path)).length === 0, 'no places when Overpass is down');

  // 6. Suggestions: many results, de-duplicated, Indian first, with a kind label.
  const s = await suggestPlaces('falls', { lat: 11, lng: 77 });
  console.log('suggest:', s.map((x) => `${x.name}(${x.kind})`).join(' | '));
  assert(s.length >= 3, 'several suggestions');
  assert(s.filter((x) => x.name === 'Hogenakkal Falls').length === 1, 'deduplicated');
  assert(s[s.length - 1].name === 'Falls Cafe', 'foreign result after Indian ones');
  assert(s[0].kind === 'Waterfall', 'kind label');
  assert(calls.some((c) => c.includes('location_bias_scale')), 'biased to the rider');
  console.log('ALL PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
