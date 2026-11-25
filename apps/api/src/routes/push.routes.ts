import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { sendSuccess } from '../utils/response';
import { ValidationError } from '../utils/errors';
import { getPublicKey, saveSubscription, removeSubscription } from '../services/push.service';

const router = Router();
router.use(authMiddleware);

const uid = (req: Request) => req.userId!;

router.get('/key', (_req, res) => {
  const key = getPublicKey();
  sendSuccess(res, { enabled: Boolean(key), publicKey: key });
});

router.post('/subscribe', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sub = req.body?.subscription;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) throw new ValidationError('Invalid subscription');
    await saveSubscription(uid(req), sub, req.get('user-agent') ?? undefined);
    sendSuccess(res, { subscribed: true });
  } catch (e) { next(e); }
});

router.post('/unsubscribe', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.body?.endpoint) throw new ValidationError('Missing endpoint');
    await removeSubscription(uid(req), req.body.endpoint);
    sendSuccess(res, { subscribed: false });
  } catch (e) { next(e); }
});

export default router;
