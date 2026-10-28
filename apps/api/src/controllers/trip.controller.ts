import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import { generateItinerary } from '../services/ai.service';
import {
  createTrip,
  getUserTrips,
  getTripById,
  saveItinerary,
  createRoom,
  joinRoom,
  getRoomPreview,
  getPendingRequests,
  respondToRequest,
  getApprovedMembers,
  updateItinerary,
  deleteTrip,
  getAllTripParticipants,
} from '../services/trip.service';

export async function createTripHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.userId!;
    const {
      from_place, to_place, days,
      bike_type = 'motorcycle', trip_type = 'one_way', preferences = '',
      from_lat = null, from_lng = null, to_lat = null, to_lng = null,
    } = req.body;

    if (!from_place || !to_place || !days) {
      return sendError(res, 'from_place, to_place, and days are required', 400, 'VALIDATION_ERROR');
    }

    const typeLabel = trip_type === 'round_trip' ? '↺' : trip_type === 'loop' ? '⟳' : '→';
    const title = `${from_place} ${typeLabel} ${to_place} (${days}d)`;
    const trip = await createTrip(userId, { title, from_place, to_place, from_lat, from_lng, to_lat, to_lng, days, bike_type, trip_type, preferences });
    console.log('[createTrip] trip created:', trip.id);

    let itinerary;
    try {
      itinerary = await generateItinerary(from_place, to_place, days, bike_type, trip_type, preferences);
    } catch (aiErr: unknown) {
      const msg = aiErr instanceof Error ? aiErr.message : String(aiErr);
      console.error('[createTrip] AI generation failed:', msg);
      throw new Error(`AI service failed: ${msg}`);
    }
    console.log('[createTrip] itinerary generated, days:', itinerary.length);

    await saveItinerary(trip.id, itinerary, { from_place, from_lat, from_lng, to_place, to_lat, to_lng });
    const room = await createRoom(trip.id, userId);

    return sendSuccess(res, { trip, itinerary, room }, 201);
  } catch (err) {
    next(err);
  }
}

export async function getUserTripsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const trips = await getUserTrips(req.userId!);
    return sendSuccess(res, { trips });
  } catch (err) {
    next(err);
  }
}

export async function getTripByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const trip = await getTripById(req.params.id, req.userId!);
    return sendSuccess(res, { trip });
  } catch (err) {
    next(err);
  }
}

export async function updateItineraryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { stops } = req.body;
    if (!Array.isArray(stops)) return sendError(res, 'stops array required', 400, 'VALIDATION_ERROR');
    await updateItinerary(req.params.id, req.userId!, stops);
    return sendSuccess(res, { message: 'Itinerary updated' });
  } catch (err) { next(err); }
}

export async function deleteTripHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteTrip(req.params.id, req.userId!);
    return sendSuccess(res, { message: 'Trip deleted' });
  } catch (err) { next(err); }
}

export async function joinRoomHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { invite_code } = req.body;
    if (!invite_code) return sendError(res, 'invite_code is required', 400, 'VALIDATION_ERROR');

    const result = await joinRoom(invite_code, req.userId!);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getRoomPreviewHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const preview = await getRoomPreview(req.params.inviteCode);
    return sendSuccess(res, { preview });
  } catch (err) {
    next(err);
  }
}

export async function getPendingRequestsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const requests = await getPendingRequests(req.params.id, req.userId!);
    return sendSuccess(res, { requests });
  } catch (err) {
    next(err);
  }
}

export async function respondToRequestHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { action } = req.body;
    if (action !== 'approved' && action !== 'rejected') {
      return sendError(res, 'action must be approved or rejected', 400, 'VALIDATION_ERROR');
    }
    await respondToRequest(req.params.memberId, action, req.userId!);
    return sendSuccess(res, { message: `Request ${action}` });
  } catch (err) {
    next(err);
  }
}

export async function getApprovedMembersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const members = await getApprovedMembers(req.params.id, req.userId!);
    return sendSuccess(res, { members });
  } catch (err) {
    next(err);
  }
}

export async function getAllTripParticipantsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const participants = await getAllTripParticipants(req.params.id, req.userId!);
    return sendSuccess(res, { participants });
  } catch (err) { next(err); }
}
