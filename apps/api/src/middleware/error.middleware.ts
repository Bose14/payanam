import { Request, Response, NextFunction } from 'express';
import { ApiError } from '@payanam/types';
import { AppError } from '../utils/errors';
import { ZodError } from 'zod';

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const timestamp = new Date().toISOString();
  const requestId = req.id || 'unknown';

  console.error(`[${timestamp}] Error:`, error);

  if (error instanceof ZodError) {
    const message = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    const apiError: ApiError = {
      status: 'error',
      code: 'VALIDATION_ERROR',
      message,
      timestamp,
      requestId,
    };
    return res.status(400).json(apiError);
  }

  if (error instanceof AppError) {
    const apiError: ApiError = {
      status: 'error',
      code: error.code,
      message: error.message,
      timestamp,
      requestId,
    };
    return res.status(error.statusCode).json(apiError);
  }

  const apiError: ApiError = {
    status: 'error',
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    timestamp,
    requestId,
  };
  res.status(500).json(apiError);
}
