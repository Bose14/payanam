import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import { getProfile, updateProfile, getRiderCard } from '../services/profile.service';

export async function getProfileHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.userId!;
    const profile = await getProfile(userId);
    return sendSuccess(res, { profile });
  } catch (err) {
    next(err);
  }
}

export async function updateProfileHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.userId!;
    const updated = await updateProfile(userId, req.body);
    return sendSuccess(res, { profile: updated, message: 'Profile updated successfully' });
  } catch (err) {
    next(err);
  }
}

export async function getRiderCardHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const targetUserId = req.params.userId || req.userId!;
    const card = await getRiderCard(targetUserId);
    return sendSuccess(res, { card });
  } catch (err) {
    next(err);
  }
}

