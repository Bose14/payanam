import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import {
  startRide, endRide, getActiveSession, getSessionById,
  updateLocation, updateQuickStatus, getAllLocations,
  sendMessage, getMessages,
} from '../services/ride.service';

export async function startRideHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { tripId } = req.body;
    if (!tripId) return sendError(res, 'tripId is required', 400, 'VALIDATION_ERROR');
    const session = await startRide(tripId, req.userId!);
    return sendSuccess(res, { session }, 201);
  } catch (err) { next(err); }
}

export async function endRideHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await endRide(req.params.sessionId, req.userId!);
    return sendSuccess(res, { message: 'Ride ended' });
  } catch (err) { next(err); }
}

export async function getActiveSessionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await getActiveSession(req.params.tripId);
    return sendSuccess(res, { session });
  } catch (err) { next(err); }
}

export async function getSessionByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await getSessionById(req.params.sessionId);
    return sendSuccess(res, { session });
  } catch (err) { next(err); }
}

export async function updateLocationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { lat, lng, speedKmh = 0, heading = 0, userName = '' } = req.body;
    if (lat == null || lng == null) return sendError(res, 'lat and lng required', 400, 'VALIDATION_ERROR');
    await updateLocation(req.params.sessionId, req.userId!, userName, lat, lng, speedKmh, heading);
    return sendSuccess(res, { ok: true });
  } catch (err) { next(err); }
}

export async function updateQuickStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { quickStatus = '' } = req.body;
    await updateQuickStatus(req.params.sessionId, req.userId!, quickStatus);
    return sendSuccess(res, { ok: true });
  } catch (err) { next(err); }
}

export async function getAllLocationsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const locations = await getAllLocations(req.params.sessionId);
    return sendSuccess(res, { locations });
  } catch (err) { next(err); }
}

export async function sendMessageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { message, messageType = 'chat', userName = '' } = req.body;
    if (!message) return sendError(res, 'message is required', 400, 'VALIDATION_ERROR');
    const msg = await sendMessage(req.params.sessionId, req.userId!, userName, message, messageType);
    return sendSuccess(res, { message: msg }, 201);
  } catch (err) { next(err); }
}

export async function getMessagesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const since = req.query.since as string | undefined;
    const messages = await getMessages(req.params.sessionId, since);
    return sendSuccess(res, { messages });
  } catch (err) { next(err); }
}
