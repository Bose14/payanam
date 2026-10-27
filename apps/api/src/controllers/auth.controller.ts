import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@payanam/types';
import { registerUser, loginUser, getUserById } from '../services/auth.service';
import { validateLoginInput, validateRegisterInput } from '../utils/validators';

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const input = validateRegisterInput(req.body);
    const authResponse = await registerUser(input.email, input.password, input.fullName);

    const response: ApiResponse = {
      status: 'success',
      data: authResponse,
      timestamp: new Date().toISOString(),
      requestId: req.id,
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const input = validateLoginInput(req.body);
    const authResponse = await loginUser(input.email, input.password);

    const response: ApiResponse = {
      status: 'success',
      data: authResponse,
      timestamp: new Date().toISOString(),
      requestId: req.id,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const user = await getUserById(req.userId);

    const response: ApiResponse = {
      status: 'success',
      data: user,
      timestamp: new Date().toISOString(),
      requestId: req.id,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const response: ApiResponse = {
      status: 'success',
      message: 'Logged out successfully',
      timestamp: new Date().toISOString(),
      requestId: req.id,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
}
