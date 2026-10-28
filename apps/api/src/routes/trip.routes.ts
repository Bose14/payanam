import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  createTripHandler,
  getUserTripsHandler,
  getTripByIdHandler,
  joinRoomHandler,
  updateItineraryHandler,
} from '../controllers/trip.controller';

const router = Router();

router.use(authMiddleware);

router.post('/', createTripHandler);
router.get('/', getUserTripsHandler);
router.get('/:id', getTripByIdHandler);
router.put('/:id/itinerary', updateItineraryHandler);

export default router;

export const roomRoutes = Router();
roomRoutes.use(authMiddleware);
roomRoutes.post('/join', joinRoomHandler);
