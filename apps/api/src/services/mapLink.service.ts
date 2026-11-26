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
}

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
      headers: { 'User-Agent': UA, 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(7000),
    });
    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc) {
      url = new URL(loc, url).href;
      // Parse as soon as a hop carries a point; no need to load the page.
      if (parseMapUrl(url)?.lat !== undefined) return { url, html: '' };
      continue;
    }
    const html = res.ok ? (await res.text()).slice(0, 400_000) : '';
    return { url, html };
  }
  throw new MapLinkError('That link redirects too many times.');
}

function fromHtml(html: string): { name: string; lat?: number; lng?: number } {
  const meta = (prop: string) =>
    html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))?.[1] ??
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'))?.[1];
  const lat = parseFloat(meta('place:location:latitude') ?? '');
  const lng = parseFloat(meta('place:location:longitude') ?? '');
  const title = (meta('og:title') ?? html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? '')
    .replace(/&amp;/g, '&').replace(/ - Google Maps$/i, '').replace(/\s*[—-]\s*Apple Maps$/i, '').trim();
  const name = /^(google maps|maps|apple maps)$/i.test(title) ? '' : title.slice(0, 120);
  return validCoord(lat, lng) ? { name, lat, lng } : { name };
}

async function geocodeName(name: string, doFetch: Fetcher): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await doFetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=1`, {
      headers: { 'User-Agent': 'Payanam-App/1.0', 'Accept-Language': 'en' }, signal: AbortSignal.timeout(5000),
    });
    const d = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (d?.[0]) return { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) };
  } catch { /* fall through */ }
  return null;
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

  let parsed = parseMapUrl(raw);
  if (!parsed) {
    const { url, html } = await followRedirects(raw, doFetch);
    const afterUrl = parseMapUrl(url);
    if (afterUrl && afterUrl.lat !== undefined) parsed = afterUrl;
    else {
      const page = fromHtml(html);
      const source = afterUrl?.source ?? (new URL(url).hostname.includes('apple') ? 'apple' : 'google');
      const name = afterUrl?.name || page.name;
      if (page.lat !== undefined && page.lng !== undefined) parsed = { name, lat: page.lat, lng: page.lng, source };
      else if (name) parsed = { name, source };
    }
  }
  if (!parsed) throw new MapLinkError('Could not read a place from that link. Open the place in Maps, tap Share, and paste that link.');

  if (parsed.lat === undefined) {
    const g = await geocodeName(parsed.name, doFetch);
    if (!g) throw new MapLinkError(`Found "${parsed.name}" but could not locate it. Share the exact pin from Maps instead.`);
    return { name: parsed.name, lat: g.lat, lng: g.lng, source: parsed.source };
  }
  const name = parsed.name || (await reverseName(parsed.lat, parsed.lng, doFetch)) || 'Dropped pin';
  return { name, lat: parsed.lat, lng: parsed.lng, source: parsed.source };
}
