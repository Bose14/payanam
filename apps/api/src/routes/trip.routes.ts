import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  createTripHandler,
  getUserTripsHandler,
  getTripByIdHandler,
  joinRoomHandler,
  getRoomPreviewHandler,
  getPendingRequestsHandler,
  respondToRequestHandler,
  getApprovedMembersHandler,
  updateItineraryHandler,
  deleteTripHandler,
  getAllTripParticipantsHandler,
} from '../controllers/trip.controller';
import {
  addExpenseHandler,
  getExpensesHandler,
  deleteExpenseHandler,
} from '../controllers/expense.controller';

const router = Router();

router.use(authMiddleware);

router.post('/', createTripHandler);
router.get('/', getUserTripsHandler);
router.get('/:id', getTripByIdHandler);
router.put('/:id/itinerary', updateItineraryHandler);
router.delete('/:id', deleteTripHandler);
router.get('/:id/requests', getPendingRequestsHandler);
router.put('/:id/requests/:memberId', respondToRequestHandler);
router.get('/:id/members', getApprovedMembersHandler);
router.get('/:id/participants', getAllTripParticipantsHandler);
router.get('/:id/expenses', getExpensesHandler);
router.post('/:id/expenses', addExpenseHandler);
router.delete('/:id/expenses/:expenseId', deleteExpenseHandler);

export default router;

export const roomRoutes = Router();
roomRoutes.use(authMiddleware);
roomRoutes.post('/join', joinRoomHandler);

// Public — no auth middleware
export const publicRoomRoutes = Router();
publicRoomRoutes.get('/preview/:inviteCode', getRoomPreviewHandler);
