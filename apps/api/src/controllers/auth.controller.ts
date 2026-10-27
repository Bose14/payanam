import { Request, Response, NextFunction } from 'express';
import { registerUser, loginUser, getUserById } from '../services/auth.service';
import { validateLoginInput, validateRegisterInput } from '../utils/validators';
import { sendSuccess } from '../utils/response';

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const input = validateRegisterInput(req.body);
    const authResponse = await registerUser(input.email, input.password, input.fullName);
    sendSuccess(res, authResponse, 201);
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const input = validateLoginInput(req.body);
    const authResponse = await loginUser(input.email, input.password);
    sendSuccess(res, authResponse);
  } catch (error) {
    next(error);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) throw new Error('User ID not found in request');
    const user = await getUserById(req.userId);
    sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, { message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
}
