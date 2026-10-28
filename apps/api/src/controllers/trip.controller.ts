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
  updateItinerary,
} from '../services/trip.service';

export async function createTripHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.userId!;
    const { from_place, to_place, days, bike_type = 'motorcycle', preferences = '' } = req.body;

    if (!from_place || !to_place || !days) {
      return sendError(res, 'from_place, to_place, and days are required', 400, 'VALIDATION_ERROR');
    }

    const title = `${from_place} → ${to_place} (${days}d)`;
    const trip = await createTrip(userId, { title, from_place, to_place, days, bike_type, preferences });
    console.log('[createTrip] trip created:', trip.id);

    let itinerary;
    try {
      itinerary = await generateItinerary(from_place, to_place, days, bike_type, preferences);
    } catch (aiErr: unknown) {
      const msg = aiErr instanceof Error ? aiErr.message : String(aiErr);
      console.error('[createTrip] AI generation failed:', msg);
      throw new Error(`AI service failed: ${msg}`);
    }
    console.log('[createTrip] itinerary generated, days:', itinerary.length);

    await saveItinerary(trip.id, itinerary);
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

export async function joinRoomHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { invite_code } = req.body;
    if (!invite_code) return sendError(res, 'invite_code is required', 400, 'VALIDATION_ERROR');

    const room = await joinRoom(invite_code, req.userId!);
    return sendSuccess(res, { room });
  } catch (err) {
    next(err);
  }
}
