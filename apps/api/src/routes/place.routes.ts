import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { sendSuccess } from '../utils/response';
import { ValidationError } from '../utils/errors';
import { resolveMapLink, MapLinkError } from '../services/mapLink.service';

const router = Router();
router.use(authMiddleware);

// POST /api/places/resolve-link { url } -> { place: { name, lat, lng, source } }
router.post('/resolve-link', async (req: Request, res: Response, next: NextFunction) => {
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

export default router;
