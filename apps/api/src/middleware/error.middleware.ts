import { Request, Response, NextFunction } from 'express';
import { ApiError } from '@payanam/types';
import { AppError } from '../utils/errors';
import { ZodError } from 'zod';

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
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

  let message = error.message || 'An unexpected error occurred';
  if (message.includes('fetch failed') || message.includes('ENOTFOUND')) {
    message = 'Database is currently unreachable or paused. Please visit https://supabase.com/dashboard to restore/unpause your Supabase project.';
  } else if (
    message.includes('phone_otps') ||
    message.includes('users.phone') ||
    message.includes('column users.phone does not exist')
  ) {
    message = "Phone authentication database tables are not set up yet. Please execute 'docs/PHONE_AUTH_SETUP.sql' in your Supabase SQL Editor.";
  }

  const apiError: ApiError = {
    status: 'error',
    code: 'INTERNAL_ERROR',
    message,
    timestamp,
    requestId,
  };
  res.status(500).json(apiError);
}
