/* Run: npx tsx scripts/test-map-links.ts */
import assert from 'node:assert';
import { parseMapUrl, resolveMapLink, MapLinkError } from '../src/services/mapLink.service';

const near = (a: number | undefined, b: number) => assert(a !== undefined && Math.abs(a - b) < 1e-4, `${a} vs ${b}`);

// Full Google link: pin (!3d!4d) wins over the map centre (@).
let r = parseMapUrl('https://www.google.com/maps/place/Hogenakkal+Falls/@12.1175,77.7761,15z/data=!3m1!4b1!4m6!8m2!3d12.1180!4d77.7770!16s%2Fg')!;
assert.equal(r.name, 'Hogenakkal Falls'); near(r.lat, 12.118); near(r.lng, 77.777); assert.equal(r.source, 'google');
// Only a centre in the URL.
r = parseMapUrl('https://www.google.com/maps/place/Kolli+Hills/@11.2500,78.3500,12z')!; near(r.lat, 11.25); assert.equal(r.name, 'Kolli Hills');
// Query forms.
r = parseMapUrl('https://www.google.com/maps?q=12.1,77.7')!; near(r.lat, 12.1); assert.equal(r.name, '');
r = parseMapUrl('https://www.google.com/maps/search/?api=1&query=12.1%2C77.7')!; near(r.lng, 77.7);
r = parseMapUrl('https://maps.google.com/?ll=10.5,76.9&q=Valparai')!; near(r.lat, 10.5); assert.equal(r.name, 'Valparai');
r = parseMapUrl('https://www.google.co.in/maps/place/Mettur+Dam/@11.8,77.8,15z')!; near(r.lng, 77.8);
// Apple forms.
r = parseMapUrl('https://maps.apple.com/?ll=12.1,77.7&q=Hogenakkal%20Falls')!; near(r.lat, 12.1); assert.equal(r.name, 'Hogenakkal Falls'); assert.equal(r.source, 'apple');
r = parseMapUrl('https://maps.apple.com/place?coordinate=12.1,77.7&name=Dhaba%20X&address=NH44')!; near(r.lng, 77.7); assert.equal(r.name, 'Dhaba X');
r = parseMapUrl('https://maps.apple.com/?address=Salem,%20Tamil%20Nadu')!; assert.equal(r.lat, undefined); assert.equal(r.name, 'Salem, Tamil Nadu');
// Not a maps link.
assert.equal(parseMapUrl('https://evil.example.com/maps?q=1,2'), null);
assert.equal(parseMapUrl('not a url'), null);

let photon = false;
(async () => {
  const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
  const fetcher = (async (url: string) => {
    if (url === 'https://maps.app.goo.gl/AbC') return new Response(null, { status: 302, headers: { location: 'https://www.google.com/maps/place/Pykara+Falls/@11.46,76.58,17z/data=!3d11.4601!4d76.5802' } });
    if (url === 'https://maps.app.goo.gl/loop') return new Response(null, { status: 302, headers: { location: 'https://evil.example.com/steal' } });
    if (url === 'https://maps.apple/p/xyz') return new Response('<html><head><meta property="og:title" content="Kodaikanal Lake"><meta property="place:location:latitude" content="10.2381"><meta property="place:location:longitude" content="77.4892"></head></html>', { status: 200 });
    // The exact case from the field: modern share link -> place URL with a name and NO coordinates.
    if (url === 'https://maps.app.goo.gl/Sen') return new Response(null, { status: 302, headers: { location: 'https://www.google.com/maps/place/Senthir+bhavan,+NH79,+Tamil+Nadu+636119/data=!4m2!3m1!1s0x3babe:0x1f?utm_source=mstt_1&entry=gps' } });
    if (url.startsWith('https://www.google.com/maps/place/Senthir') && url.includes('utm_source')) return new Response('<html><head><title>Senthir bhavan - Google Maps</title><meta content="https://maps.google.com/maps/api/staticmap?center=11.5943%2C78.1796&amp;zoom=16&amp;size=256x256" itemprop="image"></head></html>', { status: 200 });
    if (url === 'https://maps.app.goo.gl/Inter') return new Response('<html><script>var l="https:\\/\\/www.google.com\\/maps\\/place\\/Pykara+Falls\\/@11.46,76.58,17z\\/data\\u003d!3d11.4601!4d76.5802?entry\\u003dttu";</script></html>', { status: 200 });
    if (url === 'https://maps.app.goo.gl/NoCoords') return new Response(null, { status: 302, headers: { location: 'https://www.google.com/maps/place/Senthir+bhavan,+NH79,+Tamil+Nadu+636119/data=!4m2' } });
    if (url.startsWith('https://www.google.com/maps/place/Senthir+bhavan,+NH79,+Tamil+Nadu+636119/data=!4m2') ) return new Response('<html><title>Senthir bhavan - Google Maps</title></html>', { status: 200 });
    if (url.includes('/search') && decodeURIComponent(url).includes('q=Senthir bhavan, NH79')) return json([]);
    if (url.includes('/search') && decodeURIComponent(url).includes('q=636119, India')) return json([{ lat: '11.59', lon: '78.18' }]);
    if (url.includes('photon.komoot.io')) return json({ features: photon ? [{ geometry: { coordinates: [78.1796, 11.5943] }, properties: { name: 'Senthir Bhavan', countrycode: 'IN' } }, { geometry: { coordinates: [80.2, 13.0] }, properties: { name: 'Far one', countrycode: 'IN' } }] : [] });
    if (url.includes('/reverse')) return json({ name: 'Cafe Cloud', display_name: 'Cafe Cloud, Ooty, Tamil Nadu, India' });
    if (url.includes('/search') && decodeURIComponent(url).includes('q=Salem')) return json([{ lat: '11.66', lon: '78.15' }]);
    if (url.includes('/search')) return json([]);
    throw new Error('unexpected ' + url);
  }) as unknown as typeof fetch;

  // Share-sheet text with a short link.
  let p = await resolveMapLink('Pykara Falls https://maps.app.goo.gl/AbC', fetcher);
  assert.equal(p.name, 'Pykara Falls'); near(p.lat, 11.4601); assert.equal(p.source, 'google');
  // Apple short link (page carries the point).
  p = await resolveMapLink('https://maps.apple/p/xyz', fetcher);
  assert.equal(p.name, 'Kodaikanal Lake'); near(p.lat, 10.2381); assert.equal(p.source, 'apple');
  // Coordinates with no name -> reverse geocoded name.
  p = await resolveMapLink('https://www.google.com/maps?q=11.4,76.7', fetcher);
  assert.match(p.name, /Cafe Cloud/);
  // Name-only Apple link is geocoded.
  p = await resolveMapLink('https://maps.apple.com/?address=Salem', fetcher);
  near(p.lat, 11.66);
  // Plain "lat, lng" typed in.
  p = await resolveMapLink('11.4, 76.7', fetcher); near(p.lng, 76.7);
  // The failing real-world link: coordinates come from the page's map image.
  p = await resolveMapLink('https://maps.app.goo.gl/Sen', fetcher);
  assert.match(p.name, /Senthir bhavan/); near(p.lat, 11.5943); near(p.lng, 78.1796); assert.ok(!p.approximate);
  // Page has no coordinates at all: fall back to looser name searches and mark it approximate.
  photon = false;
  p = await resolveMapLink('https://maps.app.goo.gl/NoCoords', fetcher);
  near(p.lat, 11.59); assert.equal(p.approximate, true); // postcode area only
  // ...and when the business itself is findable near that postcode, use its exact spot.
  photon = true;
  p = await resolveMapLink('https://maps.app.goo.gl/NoCoords', fetcher);
  near(p.lat, 11.5943); near(p.lng, 78.1796); assert.ok(!p.approximate);
  // A 200 interstitial page that only contains the place link inside a script.
  p = await resolveMapLink('https://maps.app.goo.gl/Inter', fetcher);
  assert.match(p.name, /Pykara/); near(p.lat, 11.4601);
  // SSRF guard: a redirect to another host is refused.
  await assert.rejects(() => resolveMapLink('https://maps.app.goo.gl/loop', fetcher), MapLinkError);
  await assert.rejects(() => resolveMapLink('hello', fetcher), MapLinkError);
  console.log('ALL PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
