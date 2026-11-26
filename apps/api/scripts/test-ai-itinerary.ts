/* Run: npx tsx scripts/test-ai-itinerary.ts   (mocks every network call) */
import assert from 'node:assert';

Object.assign(process.env, {
  SUPABASE_URL: 'http://localhost', SUPABASE_ANON_KEY: 'x', SUPABASE_SERVICE_ROLE_KEY: 'x',
  DATABASE_URL: 'x', JWT_SECRET: 'x'.repeat(40), GROQ_API_KEY: '',
});

// Salem (11.66,78.15) -> Munnar (10.09,77.06), straight-ish line used as the "road".
const A = { lat: 11.6643, lng: 78.146 }, B = { lat: 10.0889, lng: 77.0595 };
const line = Array.from({ length: 200 }, (_, i) => {
  const f = i / 199; return [A.lng + (B.lng - A.lng) * f, A.lat + (B.lat - A.lat) * f];
});
const towns = [
  { lat: 11.0, lng: 77.7, name: 'Erode', state: 'Tamil Nadu' },
  { lat: 10.65, lng: 77.0, name: 'Pollachi', state: 'Tamil Nadu' },
];
let aiAnswer: unknown = null;
let aiStatus = 200;
let badModels: string[] = [];
let osrmDown = false;
let geoDown = false;
let usedModels: string[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
  if (url.includes('router.project-osrm.org') && osrmDown) return json({}, 503);
  if (geoDown && (url.includes('/search') || url.includes('photon.komoot.io') || url.includes('/reverse'))) return json({}, 403);
  if (url.includes('photon.komoot.io')) return json({ features: [] });
  if (url.includes('router.project-osrm.org')) return json({ routes: [{ distance: 270000, geometry: { coordinates: line } }] });
  if (url.includes('/reverse')) {
    const q = new URL(url); const lat = +q.searchParams.get('lat')!, lng = +q.searchParams.get('lon')!;
    const t = towns.reduce((b, c) => (Math.hypot(c.lat - lat, c.lng - lng) < Math.hypot(b.lat - lat, b.lng - lng) ? c : b));
    return json({ address: { town: t.name, state: t.state } });
  }
  if (url.includes('/search')) {
    const q = decodeURIComponent(new URL(url).searchParams.get('q') || '').toLowerCase();
    if (q.includes('salem')) return json([{ lat: String(A.lat), lon: String(A.lng) }]);
    if (q.includes('munnar')) return json([{ lat: String(B.lat), lon: String(B.lng) }]);
    if (q.includes('hogenakkal')) return json([{ lat: '12.1', lon: '77.8' }]); // far off the road
    if (q.includes('marayoor')) return json([{ lat: '10.27', lng: '77.16', lon: '77.16' }]);
    return json([]);
  }
  if (url.includes('groq.com')) {
    const model = JSON.parse(String(init?.body)).model as string; usedModels.push(model);
    if (badModels.includes(model)) return json({ error: { message: 'model not found' } }, 404);
    if (aiStatus !== 200) return json({}, aiStatus);
    return json({ choices: [{ message: { content: JSON.stringify(aiAnswer) } }] });
  }
  return realFetch(input as RequestInfo, init);
}) as typeof fetch;

// make the 1.1 s Nominatim throttle instant for tests
const realSetTimeout = globalThis.setTimeout;
(globalThis as any).setTimeout = ((fn: () => void, ms?: number, ...a: unknown[]) => realSetTimeout(fn, ms && ms > 1000 && ms < 1200 ? 0 : ms, ...a)) as typeof setTimeout;

(async () => {
  const { generateItinerary } = await import('../src/services/ai.service');
  const env = (await import('../src/config/environment')).default as { GROQ_API_KEY: string };

  // 1. No AI key -> plan built from the real road. Only real town names, coordinates on the road.
  env.GROQ_API_KEY = '';
  const fb = await generateItinerary('Salem', 'Munnar', 2, 'Royal Enfield', 'one_way', '');
  const names = fb.flatMap((d) => d.stops.map((s) => s.place)).join(' | ');
  console.log('fallback:', names);
  assert(!/dhaba|Highway|Scenic|Express/i.test(names), 'must not invent venue names');
  assert(fb.length === 2);
  for (const s of fb.flatMap((d) => d.stops)) {
    assert(s.lat !== undefined && s.lng !== undefined);
    const onRoad = line.some(([lng, lat]) => Math.hypot(lat - s.lat!, lng - s.lng!) < 0.05);
    assert(onRoad, `${s.place} is not on the road`);
  }
  assert(/Munnar/.test(fb[1].stops.at(-1)!.place), 'last day ends at the destination');

  // 2. AI hallucination: wrong coordinates and a place far from the road must be dropped.
  env.GROQ_API_KEY = 'gsk_test_key_123456';
  aiAnswer = { days: [
    { day: 1, stops: [
      { order: 1, place: 'Erode, Tamil Nadu', type: 'meal', lat: 11.0, lng: 77.7, description: 'x' },
      { order: 2, place: 'Hogenakkal Falls, Tamil Nadu', type: 'attraction', lat: 12.1, lng: 77.8, description: 'off route' },
      { order: 3, place: 'Fake Dhaba Xyz, Nowhere', type: 'meal', lat: 40, lng: -100, description: 'invented' },
      { order: 4, place: 'Pollachi, Tamil Nadu', type: 'stay', lat: 10.65, lng: 77.0, description: 'x' },
    ] },
    { day: 2, stops: [
      { order: 1, place: 'Marayoor, Kerala', type: 'attraction', lat: 0, lng: 0, description: 'wrong coords, geocodable' },
      { order: 2, place: 'Munnar, Kerala', type: 'stay', lat: B.lat, lng: B.lng, description: 'x' },
    ] },
  ] };
  const ai = await generateItinerary('Salem', 'Munnar', 2, 'Bike', 'one_way', '');
  const kept = ai.flatMap((d) => d.stops.map((s) => s.place));
  console.log('verified:', kept.join(' | '));
  assert(!kept.some((p) => /Fake Dhaba|Hogenakkal/.test(p)), 'unverifiable or off-route stops are removed');
  assert(kept.includes('Marayoor, Kerala'), 'wrong coords are corrected by geocoding');

  // 3. AI mostly wrong -> distrust it, use the real route plan instead.
  aiAnswer = { days: [{ day: 1, stops: [
    { place: 'Fake A', lat: 1, lng: 1 }, { place: 'Fake B', lat: 2, lng: 2 }, { place: 'Fake C', lat: 3, lng: 3 },
    { place: 'Fake D', lat: 4, lng: 4 }, { place: 'Erode, Tamil Nadu', lat: 11.0, lng: 77.7 },
  ] }] };
  const bad = await generateItinerary('Salem', 'Munnar', 2, 'Bike', 'one_way', '');
  assert(!bad.flatMap((d) => d.stops.map((s) => s.place)).some((p) => /Fake/.test(p)));

  // 4. AI service error -> fallback.
  aiStatus = 500;
  const err = await generateItinerary('Salem', 'Munnar', 2, 'Bike', 'one_way', '');
  assert(err.length === 2 && err[1].stops.length > 0);
  // 5. First model returns 404 (retired / no access): the next model is tried and its answer used.
  aiStatus = 200; usedModels = []; badModels = ['llama-3.3-70b-versatile'];
  aiAnswer = { days: [{ day: 1, stops: [{ place: 'Erode, Tamil Nadu', lat: 11.0, lng: 77.7, type: 'meal' }, { place: 'Pollachi, Tamil Nadu', lat: 10.65, lng: 77.0, type: 'stay' }, { place: 'Munnar, Kerala', lat: B.lat, lng: B.lng, type: 'stay' }] }, { day: 2, stops: [{ place: 'Marayoor, Kerala', lat: 10.27, lng: 77.16, type: 'attraction' }, { place: 'Munnar Tea Gardens, Kerala', lat: 10.1, lng: 77.06, type: 'attraction' }] }] };
  const m = await generateItinerary('Salem', 'Munnar', 2, 'Bike', 'one_way', '');
  assert(usedModels.length >= 2 && usedModels[0] === 'llama-3.3-70b-versatile', 'next model tried after a 404: ' + usedModels);
  assert(m.flatMap((d) => d.stops).length >= 4, 'AI plan is used');
  badModels = [];

  // 6. Router down: still a plan, from real towns along the straight line.
  env.GROQ_API_KEY = ''; osrmDown = true;
  const nr = await generateItinerary('Salem', 'Munnar', 2, 'Bike', 'one_way', '');
  assert(nr.every((d) => d.stops.length > 0), 'no empty days without the router');

  // 7. Every geocoder and the router down: never an empty plan. The destination is still listed.
  geoDown = true;
  const nothing = await generateItinerary('Salem', 'Munnar', 1, 'Bike', 'one_way', '');
  console.log('worst case:', JSON.stringify(nothing.map((d) => d.stops.map((s) => s.place))));
  assert(nothing[0].stops.some((s) => /Munnar/.test(s.place)), 'destination is always present');
  console.log('ALL PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
