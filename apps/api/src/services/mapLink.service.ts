/**
 * Turns a pasted Google Maps or Apple Maps link into a place with coordinates.
 *
 * We read the coordinates out of the link and store them. Payanam can then open that
 * same point in Google Maps or Apple Maps, whichever app the rider prefers, so a Google
 * link works for someone on an iPhone and an Apple link works for someone on Android.
 */

export interface ResolvedPlace {
  name: string;
  lat: number;
  lng: number;
  source: 'google' | 'apple';
  /** True when the point came from a name search, not from the link itself. */
  approximate?: boolean;
}

// We identify ourselves honestly. Google's short links redirect for this identity, whereas a
// browser identity gets a 40 KB interstitial page with no place in it.
const UA = 'Mozilla/5.0 (compatible; PayanamBot/1.0; +https://payanam.app)';

export class MapLinkError extends Error {}

function isAllowedHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    /^(www\.|maps\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(h) ||
    h === 'maps.app.goo.gl' ||
    h === 'goo.gl' ||
    h === 'maps.apple.com' ||
    h === 'maps.apple' ||
    h === 'consent.google.com'
  );
}

function validCoord(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

function parsePair(v: string | null | undefined): { lat: number; lng: number } | null {
  if (!v) return null;
  const m = v.trim().match(/^(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  return validCoord(lat, lng) ? { lat, lng } : null;
}

function cleanName(v: string | null | undefined): string {
  if (!v) return '';
  let s = v;
  try { s = decodeURIComponent(v.replace(/\+/g, ' ')); } catch { s = v.replace(/\+/g, ' '); }
  s = s.replace(/\s+/g, ' ').trim();
  return parsePair(s) ? '' : s.slice(0, 120);
}

/** Reads what the URL itself carries. Returns null when it has no usable point. */
export function parseMapUrl(raw: string): { name: string; lat: number; lng: number; source: 'google' | 'apple' } | { name: string; lat?: undefined; lng?: undefined; source: 'google' | 'apple' } | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  const host = u.hostname.toLowerCase();
  const isApple = host === 'maps.apple.com' || host === 'maps.apple';
  const isGoogle = !isApple && isAllowedHost(host);
  if (!isApple && !isGoogle) return null;
  const q = u.searchParams;
  const href = decodeURIComponent(u.href);

  if (isApple) {
    const pt = parsePair(q.get('coordinate')) ?? parsePair(q.get('ll')) ?? parsePair(q.get('sll')) ?? parsePair(q.get('q')) ?? parsePair(q.get('daddr'));
    const name = cleanName(q.get('name')) || cleanName(q.get('q')) || cleanName(q.get('address')) || cleanName(q.get('daddr'));
    return pt ? { ...pt, name, source: 'apple' } : name ? { name, source: 'apple' } : null;
  }

  // Google. The pin (!3d..!4d..) is more exact than the map-centre "@lat,lng".
  const pin = href.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  const at = href.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  let point: { lat: number; lng: number } | null = null;
  if (pin && validCoord(+pin[1], +pin[2])) point = { lat: +pin[1], lng: +pin[2] };
  point = point ?? parsePair(q.get('q')) ?? parsePair(q.get('query')) ?? parsePair(q.get('ll')) ?? parsePair(q.get('destination')) ?? parsePair(q.get('center'));
  if (!point && at && validCoord(+at[1], +at[2])) point = { lat: +at[1], lng: +at[2] };

  const placeSeg = u.pathname.match(/\/maps\/place\/([^/]+)/) ?? u.pathname.match(/\/maps\/search\/([^/]+)/);
  const name = cleanName(placeSeg?.[1]) || cleanName(q.get('q')) || cleanName(q.get('query'));
  return point ? { ...point, name, source: 'google' } : name ? { name, source: 'google' } : null;
}

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/** Follow redirects by hand so every hop stays on a Google or Apple Maps host. */
async function followRedirects(startUrl: string, doFetch: Fetcher): Promise<{ url: string; html: string }> {
  let url = startUrl;
  for (let hop = 0; hop < 7; hop++) {
    const host = new URL(url).hostname;
    if (!isAllowedHost(host)) throw new MapLinkError('That link is not a Google Maps or Apple Maps link.');
    const res = await doFetch(url, {
      redirect: 'manual',
      headers: {
        'User-Agent': UA,
        'Accept-Language': 'en-IN,en;q=0.9',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(8000),
    });
    const loc = res.headers.get('location');
    console.log(`[mapLink] hop ${hop} ${res.status} ${host}${new URL(url).pathname.slice(0, 60)}${loc ? ' -> ' + new URL(loc, url).hostname : ''}`);
    if (res.status >= 300 && res.status < 400 && loc) {
      url = new URL(loc, url).href;
      // Google may route through a consent page; the real target is in its `continue` parameter.
      const next = new URL(url);
      if (next.hostname === 'consent.google.com' && next.searchParams.get('continue')) url = next.searchParams.get('continue')!;
      // Parse as soon as a hop carries a point; no need to load the page.
      if (parseMapUrl(url)?.lat !== undefined) return { url, html: '' };
      continue;
    }
    const html = res.ok ? (await res.text()).slice(0, 900_000) : '';
    console.log(`[mapLink] final ${res.status} ${host} html=${html.length}B coords=${coordsFromHtml(html) ? 'yes' : 'no'}`);
    return { url, html };
  }
  throw new MapLinkError('That link redirects too many times.');
}

/** Every place a Google or Apple place page is known to carry its coordinates. Most exact first. */
function coordsFromHtml(html: string): { lat: number; lng: number } | null {
  const text = html.replace(/&amp;/g, '&').replace(/\\u003d/g, '=').replace(/\\u0026/g, '&').replace(/%2C/gi, ',');
  const tries: Array<[RegExp, 'latlng' | 'lnglat']> = [
    [/place:location:latitude["'][^>]*content=["'](-?\d+(?:\.\d+)?)["'][\s\S]{0,200}?place:location:longitude["'][^>]*content=["'](-?\d+(?:\.\d+)?)/i, 'latlng'],
    [/staticmap\?center=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i, 'latlng'],
    [/[?&]center=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i, 'latlng'],
    [/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, 'latlng'],
    [/APP_INITIALIZATION_STATE=\[\[\[-?[\d.eE+-]+,(-?\d+\.\d+),(-?\d+\.\d+)\]/, 'lnglat'],
    [/\[null,null,(-?\d{1,2}\.\d{3,}),(-?\d{1,3}\.\d{3,})\]/, 'latlng'],
    [/@(-?\d{1,2}\.\d{3,}),(-?\d{1,3}\.\d{3,})/, 'latlng'],
  ];
  for (const [re, order] of tries) {
    const m = text.match(re);
    if (!m) continue;
    const a = parseFloat(m[1]);
    const b = parseFloat(m[2]);
    const lat = order === 'latlng' ? a : b;
    const lng = order === 'latlng' ? b : a;
    if (validCoord(lat, lng)) return { lat, lng };
  }
  return null;
}

function fromHtml(html: string): { name: string; lat?: number; lng?: number } {
  const meta = (prop: string) =>
    html.match(new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))?.[1] ??
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name|itemprop)=["']${prop}["']`, 'i'))?.[1];
  const title = (meta('og:title') ?? html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? '')
    .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/ - Google Maps$/i, '').replace(/\s*[—-]\s*Apple Maps$/i, '').trim();
  const name = /^(google maps|maps|apple maps|before you continue.*)$/i.test(title) ? '' : title.slice(0, 120);
  const pt = coordsFromHtml(html);
  return pt ? { name, ...pt } : { name };
}

async function geocodeOnce(q: string, doFetch: Fetcher): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await doFetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`, {
      headers: { 'User-Agent': 'Payanam-App/1.0', 'Accept-Language': 'en' }, signal: AbortSignal.timeout(5000),
    });
    const d = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (d?.[0]) return { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) };
  } catch { /* try the next wording */ }
  return null;
}

async function photonSearch(q: string, bias: { lat: number; lng: number } | null, doFetch: Fetcher): Promise<{ lat: number; lng: number; name: string } | null> {
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&lang=en` + (bias ? `&lat=${bias.lat}&lon=${bias.lng}&location_bias_scale=0.3` : '');
    const res = await doFetch(url, { headers: { 'User-Agent': 'Payanam-App/1.0' }, signal: AbortSignal.timeout(6000) });
    const d = (await res.json()) as { features?: Array<{ geometry: { coordinates: [number, number] }; properties: { name?: string; countrycode?: string } }> };
    const hits = (d.features ?? []).filter((f) => !f.properties.countrycode || f.properties.countrycode === 'IN');
    const pick = bias
      ? hits.map((f) => ({ f, km: kmBetween(bias, { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] }) })).sort((a, b) => a.km - b.km)[0]
      : hits[0] && { f: hits[0], km: 0 };
    if (!pick || (bias && pick.km > 35)) return null;
    return { lat: pick.f.geometry.coordinates[1], lng: pick.f.geometry.coordinates[0], name: pick.f.properties.name ?? '' };
  } catch { return null; }
}

function kmBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/**
 * Finds a point for a place name taken from a Google link. Full street addresses often fail on
 * OpenStreetMap, so this goes step by step and stops at the first success:
 *   1. the whole name, then without the postcode
 *   2. the postcode area, then a fuzzy search for the business name near that area
 *   3. looser wordings (area only)
 * Results from step 2's area-only fallback and step 3 are marked approximate.
 */
async function geocodeName(name: string, doFetch: Fetcher): Promise<{ lat: number; lng: number; exact: boolean } | null> {
  const parts = name.split(',').map((p) => p.trim()).filter(Boolean);
  const pin = name.match(/\b\d{6}\b/)?.[0];
  const noPin = name.replace(/\b\d{6}\b/, '').replace(/\s+,/g, ',').replace(/,\s*$/, '').trim();

  const first = (await geocodeOnce(name, doFetch)) ?? (noPin !== name ? await geocodeOnce(noPin, doFetch) : null);
  if (first) return { ...first, exact: true };

  // Postcode centroid, used to anchor a fuzzy search for the business itself.
  let centre: { lat: number; lng: number } | null = null;
  if (pin) {
    centre = (await geocodeOnce(`${pin}, India`, doFetch)) ?? (await geocodeOnce(pin, doFetch));
  }
  const business = parts[0] ?? name;
  const near = await photonSearch(parts.slice(0, 2).join(' '), centre, doFetch)
    ?? (parts.length > 1 ? await photonSearch(business, centre, doFetch) : null);
  if (near) return { lat: near.lat, lng: near.lng, exact: true };
  if (centre) return { ...centre, exact: false };

  const variants = [
    parts.length > 1 ? parts.slice(1).join(', ').replace(/\b\d{6}\b/, '').trim() : '',
    parts.length > 2 ? parts.slice(0, 2).join(', ') : '',
  ].filter((v) => v && v !== name && v !== noPin);
  for (const v of variants) {
    const hit = await geocodeOnce(v, doFetch);
    if (hit) return { ...hit, exact: false };
  }
  const anywhere = await photonSearch(name, null, doFetch);
  return anywhere ? { lat: anywhere.lat, lng: anywhere.lng, exact: false } : null;
}

async function reverseName(lat: number, lng: number, doFetch: Fetcher): Promise<string> {
  try {
    const res = await doFetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16`, {
      headers: { 'User-Agent': 'Payanam-App/1.0', 'Accept-Language': 'en' }, signal: AbortSignal.timeout(5000),
    });
    const d = (await res.json()) as { name?: string; display_name?: string };
    const first = d.name || d.display_name?.split(',')[0] || '';
    const rest = d.display_name?.split(',').slice(1, 3).map((s) => s.trim()).filter(Boolean).join(', ') ?? '';
    return [first, rest].filter(Boolean).join(', ').slice(0, 120);
  } catch { return ''; }
}

/** Map links inside a page we were served (meta tags, scripts, JSON with escaped slashes). */
function mapUrlsInHtml(html: string): string[] {
  const text = html
    .replace(/\\u003d/gi, '=').replace(/\\u0026/gi, '&').replace(/\\u002F/gi, '/').replace(/\\\//g, '/')
    .replace(/&amp;/g, '&');
  const found = text.match(/https?:\/\/(?:www\.|maps\.)?(?:google\.[a-z.]{2,6}\/maps|maps\.apple\.com)[^\s"'<>\\)]*/gi) ?? [];
  const uniq: string[] = [];
  for (const u of found) {
    const clean = u.replace(/[.,;]+$/, '');
    if (!uniq.includes(clean)) uniq.push(clean);
  }
  // Links that already carry a point first.
  return uniq.sort((x, y) => Number(parseMapUrl(y)?.lat !== undefined) - Number(parseMapUrl(x)?.lat !== undefined)).slice(0, 4);
}

type Found = { name: string; lat?: number; lng?: number; source: 'google' | 'apple' };

/** Follow one link and read what it gives: the final URL, the page, and map links inside the page. */
async function explore(url: string, doFetch: Fetcher, depth = 0): Promise<Found | null> {
  const landed = await followRedirects(url, doFetch);
  const afterUrl = parseMapUrl(landed.url);
  if (afterUrl && afterUrl.lat !== undefined) return afterUrl;

  const page = fromHtml(landed.html);
  const source: 'google' | 'apple' = afterUrl?.source ?? (new URL(landed.url).hostname.includes('apple') ? 'apple' : 'google');
  const name = afterUrl?.name || page.name || mapUrlsInHtml(landed.html).map(parseMapUrl).find((r) => r?.name)?.name || '';
  if (page.lat !== undefined && page.lng !== undefined) return { name, lat: page.lat, lng: page.lng, source };

  const inner = depth < 2 ? mapUrlsInHtml(landed.html).filter((u) => u !== landed.url && u !== url) : [];
  console.log(`[mapLink] ${landed.url.slice(0, 40)} title="${page.name}" inner=${inner.length}${inner[0] ? ' first=' + inner[0].slice(0, 90) : ''}`);
  let best: Found | null = name ? { name, source } : null;
  for (const u of inner) {
    const direct = parseMapUrl(u);
    if (direct && direct.lat !== undefined) return direct;
    const deeper = await explore(u, doFetch, depth + 1).catch(() => null);
    if (deeper && deeper.lat !== undefined) return deeper;
    if (!best && deeper?.name) best = deeper;
  }
  return best;
}

export async function resolveMapLink(input: string, doFetch: Fetcher = fetch): Promise<ResolvedPlace> {
  const text = (input ?? '').trim();
  // People paste "Place name https://maps.app.goo.gl/xyz" straight from the share sheet.
  const urlMatch = text.match(/https?:\/\/[^\s<>"']+/i);
  const raw = urlMatch?.[0];
  const typedPair = parsePair(text);
  if (typedPair) {
    return { ...typedPair, name: (await reverseName(typedPair.lat, typedPair.lng, doFetch)) || 'Dropped pin', source: 'google' };
  }
  if (!raw) throw new MapLinkError('Paste a Google Maps or Apple Maps link.');

  let parsed: Found | null = parseMapUrl(raw);
  if (!parsed) parsed = await explore(raw, doFetch);
  if (!parsed) throw new MapLinkError('Could not read a place from that link. Open the place in Maps, tap Share, and paste that link.');

  if (parsed.lat === undefined) {
    const g = await geocodeName(parsed.name, doFetch);
    if (!g) {
      console.warn('[mapLink] no coordinates found for', parsed.name);
      throw new MapLinkError(`Found "${parsed.name}" but could not place it on the map. Search for it by name below, or open it in Maps, drop a pin on the exact spot, tap Share and paste that link.`);
    }
    return { name: parsed.name, lat: g.lat, lng: g.lng, source: parsed.source, approximate: !g.exact };
  }
  const { lat, lng } = parsed as { lat: number; lng: number };
  const name = parsed.name || (await reverseName(lat, lng, doFetch)) || 'Dropped pin';
  return { name, lat, lng, source: parsed.source };
}
