/* Run: npx tsx scripts/test-save-itinerary.ts   (fake database) */
import assert from 'node:assert';
Object.assign(process.env, { SUPABASE_URL: 'http://localhost', SUPABASE_ANON_KEY: 'x', SUPABASE_SERVICE_ROLE_KEY: 'x', DATABASE_URL: 'x', JWT_SECRET: 'x'.repeat(40), GROQ_API_KEY: '' });
(async () => {
  const dbmod = await import('../src/config/database');
  let inserted: Array<Record<string, unknown>> = [];
  dbmod.initializeDatabase();
  (dbmod.getDatabase() as unknown as { from: unknown }).from = () => ({ insert: async (rows: Array<Record<string, unknown>>) => { inserted = rows; return { error: null }; } });
  const { saveItinerary } = await import('../src/services/trip.service');
  const ends = { from_place: 'A', from_lat: 11.5, from_lng: 78.0, to_place: 'B', to_lat: 11.6, to_lng: 78.1 };

  // Point to point, no stops: start and end rows, with real order numbers.
  await saveItinerary('t1', [{ day: 1, stops: [] }], ends);
  assert.deepStrictEqual(inserted.map((r) => r.place), ['A', 'B']);
  assert(inserted.every((r) => Number.isFinite(r.order_index as number)), 'order_index must be a number: ' + JSON.stringify(inserted.map((r) => r.order_index)));
  assert((inserted[0].order_index as number) < (inserted[1].order_index as number));

  // With one tea stop between them.
  await saveItinerary('t1', [{ day: 1, stops: [{ order: 1, place: 'Tea', type: 'rest', description: '', estimatedKm: 5, durationHours: 0.25, tips: '', lat: 11.55, lng: 78.05 }] }], ends);
  assert.deepStrictEqual(inserted.map((r) => r.place), ['A', 'Tea', 'B']);
  assert(inserted.every((r) => Number.isFinite(r.order_index as number)));
  console.log('ALL PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
