/* Run: npx tsx scripts/test-realtime.ts   (fetch is mocked) */
import assert from 'node:assert';
Object.assign(process.env, { SUPABASE_URL: 'http://localhost', SUPABASE_ANON_KEY: 'x', SUPABASE_SERVICE_ROLE_KEY: 'x', DATABASE_URL: 'x', JWT_SECRET: 'x'.repeat(40), GROQ_API_KEY: '' });
(async () => {
  const { broadcastToUsers } = await import('../src/services/realtime.service');
  const calls: Array<{ u: string; body: { messages: Array<{ topic: string }> } }> = [];
  (globalThis as { fetch: unknown }).fetch = async (u: string, i: { body: string }) => { calls.push({ u, body: JSON.parse(i.body) }); return { ok: true, status: 200 }; };

  // Duplicates and empty ids are dropped; more than 100 people are sent in batches of 100.
  const ids = Array.from({ length: 150 }, (_, i) => `u${i}`);
  await broadcastToUsers([...ids, 'u1', ''], 'chat', { key: 'k' });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].body.messages.length, 100);
  assert.equal(calls[1].body.messages.length, 50);
  assert.equal(calls[0].body.messages[0].topic, 'user:u0');
  assert.ok(calls[0].u.endsWith('/realtime/v1/api/broadcast'));

  // Nobody to tell: no request.
  calls.length = 0;
  await broadcastToUsers([], 'ride');
  assert.equal(calls.length, 0);

  // A failing network never throws into the request that caused it.
  (globalThis as { fetch: unknown }).fetch = async () => { throw new Error('down'); };
  await broadcastToUsers(['a'], 'ride');
  console.log('ALL PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
