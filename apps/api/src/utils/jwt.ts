import jwt from 'jsonwebtoken';
import { TokenPayload } from '@payanam/types';
import env from '../config/environment';

export function generateAccessToken(userId: string, email: string): string {
  const payload: TokenPayload = {
    userId,
    email,
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRY,
  });
}

export function generateRefreshToken(userId: string): string {
  const payload = { userId };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.REFRESH_TOKEN_EXPIRY,
  });
}

export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    return decoded as TokenPayload;
  } catch {
    throw new Error('Invalid or expired token');
  }
}
