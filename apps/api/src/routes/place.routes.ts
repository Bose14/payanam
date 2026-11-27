import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { sendSuccess } from '../utils/response';
import { ValidationError } from '../utils/errors';
import { resolveMapLink, MapLinkError } from '../services/mapLink.service';
import { suggestPlaces } from '../services/placeSearch.service';
import { fetchBestRoute, type LatLng } from '../services/route.service';
import { poisAlongRoute, KIND_LABEL } from '../services/routePlaces.service';
import { geocodePlace } from '../services/ai.service';

const coord = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

const router = Router();
router.use(authMiddleware);

const MINUTE = 60 * 1000;
const limitSuggest = rateLimit({ name: 'SUGGEST', windowMs: MINUTE, max: 90 });
const limitRoute = rateLimit({ name: 'ROUTE', windowMs: MINUTE, max: 12 });
const limitLink = rateLimit({ name: 'LINK', windowMs: MINUTE, max: 20 });

// POST /api/places/resolve-link { url } -> { place: { name, lat, lng, source } }
router.post('/resolve-link', limitLink, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const url = req.body?.url;
    if (typeof url !== 'string' || !url.trim() || url.length > 2000) throw new ValidationError('Paste a map link');
    const place = await resolveMapLink(url);
    sendSuccess(res, { place });
  } catch (e) {
    if (e instanceof MapLinkError) return next(new ValidationError(e.message));
    next(e);
  }
});

// GET /api/places/suggest?q=&lat=&lng= -> { suggestions: [{ name, subtitle, lat, lng, kind }] }
router.get('/suggest', limitSuggest, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q.length < 2 || q.length > 100) return sendSuccess(res, { suggestions: [] });
    const lat = coord(req.query.lat);
    const lng = coord(req.query.lng);
    const suggestions = await suggestPlaces(q, lat !== null && lng !== null ? { lat, lng } : undefined);
    sendSuccess(res, { suggestions });
  } catch (e) { next(e); }
});

// GET /api/places/along-route?fromLat&fromLng&toLat&toLng (or from & to as names)
//   -> { route: { distanceKm, durationMin }, places: [{ name, lat, lng, kind, label, type, km, offKm }] }
router.get('/along-route', limitRoute, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resolve = async (latKey: string, lngKey: string, nameKey: string): Promise<LatLng | null> => {
      const lat = coord(req.query[latKey]);
      const lng = coord(req.query[lngKey]);
      if (lat !== null && lng !== null) return { lat, lng };
      const name = typeof req.query[nameKey] === 'string' ? (req.query[nameKey] as string).trim() : '';
      return name ? geocodePlace(name.slice(0, 120)) : null;
    };
    const [from, to] = await Promise.all([resolve('fromLat', 'fromLng', 'from'), resolve('toLat', 'toLng', 'to')]);
    if (!from || !to) throw new ValidationError('Set the start and the destination first');
    const best = await fetchBestRoute(from, to);
    if (!best) return sendSuccess(res, { route: null, places: [] });
    const pois = await poisAlongRoute(best.path);
    sendSuccess(res, {
      route: { distanceKm: Math.round(best.distanceKm), durationMin: Math.round(best.durationMin) },
      places: pois.map((p) => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng, kind: p.kind, label: KIND_LABEL[p.kind], type: p.type, km: p.km, offKm: p.offKm })),
    });
  } catch (e) { next(e); }
});

export default router;
