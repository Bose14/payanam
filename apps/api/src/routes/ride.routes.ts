import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  startRideHandler, endRideHandler, getActiveSessionHandler,
  getSessionByIdHandler, updateLocationHandler, updateLocationBatchHandler,
  updateQuickStatusHandler, getAllLocationsHandler, getRiderTrailsHandler,
  sendMessageHandler, getMessagesHandler,
} from '../controllers/ride.controller';

const router = Router();
router.use(authMiddleware);

router.post('/start', startRideHandler);
router.get('/active/:tripId', getActiveSessionHandler);
router.get('/:sessionId', getSessionByIdHandler);
router.post('/:sessionId/end', endRideHandler);
router.put('/:sessionId/location', updateLocationHandler);
router.post('/:sessionId/locations/batch', updateLocationBatchHandler);
router.get('/:sessionId/trails', getRiderTrailsHandler);
router.put('/:sessionId/status', updateQuickStatusHandler);
router.get('/:sessionId/locations', getAllLocationsHandler);
router.post('/:sessionId/messages', sendMessageHandler);
router.get('/:sessionId/messages', getMessagesHandler);

export default router;
