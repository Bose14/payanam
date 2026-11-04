import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  getProfileHandler,
  updateProfileHandler,
  getRiderCardHandler,
} from '../controllers/profile.controller';

const router = Router();

router.use(authMiddleware);

router.get('/', getProfileHandler);
router.put('/', updateProfileHandler);
router.get('/card', getRiderCardHandler);
router.get('/card/:userId', getRiderCardHandler);

export default router;

