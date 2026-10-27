import { Response } from 'express';

export function sendSuccess(res: Response, data: unknown, statusCode = 200) {
  res.status(statusCode).json({
    status: 'success',
    data,
    timestamp: new Date().toISOString(),
  });
}

export function sendError(res: Response, message: string, statusCode = 400, code = 'ERROR') {
  res.status(statusCode).json({
    status: 'error',
    error: { code, message },
    timestamp: new Date().toISOString(),
  });
}
