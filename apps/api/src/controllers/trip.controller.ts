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
  addStopToTrip,
  deleteTrip,
  getAllTripParticipants,
  removeMember,
  getRoomMemberStatus,
  getPendingRequestsCount,
  updateTripStatus,
} from '../services/trip.service';

export async function createTripHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.userId!;
    const {
      from_place, to_place, days,
      bike_type = 'motorcycle', trip_type = 'one_way', preferences = '',
      from_lat = null, from_lng = null, to_lat = null, to_lng = null,
      itinerary_mode = 'ai',
      max_members,
    } = req.body;

    const maxMembers = Number(max_members);
    if (!Number.isInteger(maxMembers) || maxMembers < 2 || maxMembers > 100) {
      return sendError(res, 'Enter the number of riders in the group (2 to 100)', 400, 'VALIDATION_ERROR');
    }

    if (itinerary_mode !== 'ai' && itinerary_mode !== 'manual') {
      return sendError(res, "itinerary_mode must be 'ai' or 'manual'", 400, 'VALIDATION_ERROR');
    }

    if (!from_place || !to_place || !days) {
      return sendError(res, 'from_place, to_place, and days are required', 400, 'VALIDATION_ERROR');
    }

    const parsedDays = Math.max(1, Math.min(Number(days) || 1, 14));
    const typeLabel = trip_type === 'round_trip' ? '↺' : trip_type === 'loop' ? '⟳' : '→';
    const title = `${from_place} ${typeLabel} ${to_place} (${parsedDays}d)`;
    const trip = await createTrip(userId, {
      title,
      from_place,
      to_place,
      from_lat,
      from_lng,
      to_lat,
      to_lng,
      days: parsedDays,
      bike_type,
      trip_type,
      preferences,
      max_members: maxMembers,
    });
    console.log('[createTrip] trip created:', trip.id);

    // The AI planner only runs when the rider explicitly chooses it. A manual trip starts
    // with an empty itinerary and the rider adds stops one by one.
    let itinerary: Awaited<ReturnType<typeof generateItinerary>> = [];
    if (itinerary_mode === 'ai') {
      try {
        itinerary = await generateItinerary(from_place, to_place, parsedDays, bike_type, trip_type, preferences, {
          fromLat: from_lat, fromLng: from_lng, toLat: to_lat, toLng: to_lng,
        });
      } catch (aiErr: unknown) {
        const msg = aiErr instanceof Error ? aiErr.message : String(aiErr);
        console.error('[createTrip] AI generation failed:', msg);
        throw new Error(`AI service failed: ${msg}`);
      }
      console.log('[createTrip] itinerary generated, days:', itinerary.length);
      await saveItinerary(trip.id, itinerary, { from_place, from_lat, from_lng, to_place, to_lat, to_lng });
    }
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
    const { stops, days } = req.body;
    if (!Array.isArray(stops)) return sendError(res, 'stops array required', 400, 'VALIDATION_ERROR');
    if (days !== undefined && (typeof days !== 'number' || !Number.isFinite(days) || days < 1)) {
      return sendError(res, 'days must be a positive number', 400, 'VALIDATION_ERROR');
    }
    await updateItinerary(req.params.id, req.userId!, stops, days);
    return sendSuccess(res, { message: 'Itinerary updated' });
  } catch (err) { next(err); }
}

export async function addStopHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { place, item_type, description, day_number, order_index, lat, lng } = req.body;
    if (!place || typeof place !== 'string') return sendError(res, 'place is required', 400, 'VALIDATION_ERROR');
    const stop = await addStopToTrip(req.params.id, req.userId!, {
      place: place.trim(),
      item_type,
      description,
      day_number,
      order_index,
      lat,
      lng,
    });
    return sendSuccess(res, { stop, message: 'Stop added to itinerary' }, 201);
  } catch (err) { next(err); }
}

export async function deleteTripHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteTrip(req.params.id, req.userId!);
    return sendSuccess(res, { message: 'Trip deleted' });
  } catch (err) { next(err); }
}

export async function updateTripStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { status } = req.body;
    if (!status || !['planning', 'active', 'completed'].includes(status)) {
      return res.status(400).json({ status: 'error', message: 'Invalid status. Must be planning, active, or completed.' });
    }
    const result = await updateTripStatus(req.params.id, req.userId!, status);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
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

export async function getRoomMemberStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getRoomMemberStatus(req.params.inviteCode, req.userId!);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getPendingRequestsCountHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const counts = await getPendingRequestsCount(req.userId!);
    return sendSuccess(res, { counts });
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

export async function removeMemberHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await removeMember(req.params.id, req.params.memberId, req.userId!);
    return sendSuccess(res, { message: 'Member removed successfully' });
  } catch (err) {
    next(err);
  }
}
